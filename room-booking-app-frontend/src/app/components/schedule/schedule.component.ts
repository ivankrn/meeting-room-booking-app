import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CalendarEvent, CalendarView, CalendarDateFormatter, DAYS_OF_WEEK } from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { map, Subject, forkJoin, defaultIfEmpty } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { Socket } from 'ngx-socket-io';
import { IDropdownSettings } from 'ng-multiselect-dropdown';

@Component({
  selector: 'app-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css'],
  providers: [
    {
      provide: CalendarDateFormatter,
      useClass: CustomDateFormatter,
    }
  ]
})
export class ScheduleComponent implements OnInit {

  /**
   * Временной диапазон для отображения расписания.
   */
  view: CalendarView = CalendarView.Week;

  /**
   * Дата для отображения расписания.
   */
  viewDate: Date = new Date();

  locale: string = "ru";
  weekStartsOn: number = DAYS_OF_WEEK.MONDAY;
  dayStartHour: number = 6;
  dayEndHour: number = 20;

  /**
   * Разность между интервалом продления подписки и временем истечения подписки (необходима для того, чтобы запрос на продление подписки
   * успевал обработаться до истечения существующей подписки).
   */
  static readonly handicapInSeconds = 3;
  static readonly subscriptionLifetimeInMinutes = 1;

  events: CalendarEvent[] = [];
  updated: Subject<void> = new Subject<void>();
  calendarsList = [];
  selectedCalendars = [];
  dropdownSelectText = "Выберите переговорные";
  dropdownSettings: IDropdownSettings = {
    singleSelection: false,
    idField: 'cal_id',
    textField: 'cal_name',
    selectAllText: 'Выбрать все переговорные',
    unSelectAllText: 'Сбросить выделение',
    noDataAvailablePlaceholderText: 'Загрузка...',
    itemsShowLimit: 1,
  };
  @ViewChild('calendarDropdown')
  calendarDropdownElement;

  constructor(private httpClient: HttpClient, private msalService: MsalService, private socket: Socket) {
  }

  ngOnInit(): void {
    this.callCalendars();
    this.postToken();
    this.socket.on("schedule_update", () => this.callEvents());
    this.socket.on("add_event", e => {
      const calendarEvent: CalendarEvent = {
        id: e["id"],
        title: e["subject"],
        start: new Date(e["start"] + 'Z'),
        end: new Date(e["end"] + "Z"),
        meta: {
          organizer: e["organizer"],
        }
      };
      this.events.push(calendarEvent);
      this.updated.next();
    });
    this.socket.on("delete_event", eventId => {
      for (let i = 0; i < this.events.length; i++) {
        if (this.events[i].id == eventId) {
          this.events.splice(i, 1);
          this.updated.next();
        }
      }
    });
    this.socket.on("reconnect", () => {
      this.selectedCalendars.forEach(cal => {
        const calendarApiId = this.getSelectedCalendarApiId(cal);
        this.joinRoomByCalendarId(calendarApiId);
      });
    });
    setInterval( () => this.postToken(), 5 * 60 * 1000 );
  }

  /**
   * Обновляет токен доступа на сервере.
   */
  postToken() {
    const accessTokenRequest = {
      scopes: ["user.read", "calendars.read"],
      account: this.msalService.instance.getActiveAccount(),
      forceRefresh: true,
    };
    this.msalService.acquireTokenSilent(accessTokenRequest)
    .pipe(map(authResult => this.httpClient.post("http://localhost:8080/token", authResult.accessToken).subscribe()))
    .subscribe();
  }

  /**
   * Меняет текущий временной диапазон календаря.
   * 
   * @param view - Временной диапазон, который необходимо отобразить
   */
  setView(view: string) {
    switch (view) {
      case "month": {
        this.view = CalendarView.Month;
        break;
      }
      case "week": {
        this.view = CalendarView.Week;
        break;
      }
      case "day": {
        this.view = CalendarView.Day;
        break;
      }
    }
  }

  /**
   * Запрашивает список событий из выбранных календарей Outlook и по получении обрабатывает их, после чего обновляет текущее
   * расписание на экране.
   */
  callEvents() {
    this.clearEvents();
    const calendarsTasks = [];
    this.selectedCalendars.forEach(selectedCal => {
      const calendarApiId = this.getSelectedCalendarApiId(selectedCal);
      const destinationUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarApiId}/events?$select=subject,organizer,start,end`;
      calendarsTasks.push(this.httpClient.get(destinationUrl).pipe(map(response => this.processEventsResponse(response))));
    });
    forkJoin(calendarsTasks).pipe(defaultIfEmpty(null)).subscribe(() => this.updated.next());
  }

  /**
   * Очищает текущий список событий.
   */
  clearEvents() {
    this.events.length = 0;
  }

  /**
   * Преобразовывает ответ с полученными событиями из Outlook в нужный формат и сохраняет их.
   * 
   * @param response - Ответ от Microsoft Graph с событиями из Outlook
   */
  processEventsResponse(response) {
    const rawEvents: [] = response.value;
    rawEvents.forEach(rawEvent => {
      const calendarEvent: CalendarEvent = this.getCalendarEventFromRawEvent(rawEvent);
      this.events.push(calendarEvent);
    });
  }

  /**
   * Преобразует ответ с полученным событием из Outlook и возвращает его в нужном формате.
   * 
   * @param rawEvent Ответ от Microsoft Graph с событием из Outlook
   * @returns Событие в календаре
   */
  getCalendarEventFromRawEvent(rawEvent): CalendarEvent {
    const calendarEvent: CalendarEvent = {
      id: rawEvent["id"],
      title: rawEvent['subject'],
      start: new Date(rawEvent['start']['dateTime'] + 'Z'),
      end: new Date(rawEvent['end']['dateTime'] + 'Z'),
      meta: {
        organizer: rawEvent['organizer']['emailAddress']['name'],
      },
    };
    return calendarEvent;
  }

  /**
   * Выполняет выход пользователя из аккаунта.
   */
  logout() {
    this.msalService.logout();
  }

  /**
   * Присоединяется к SocketIO комнате, соответствующей указанному ID календаря.
   * 
   * @param calApiId ID календаря Outlook
   */
  joinRoomByCalendarId(calApiId: string) {
    this.socket.emit("join_calendar_room", calApiId);
  }

    /**
   * Отключается от SocketIO комнаты, соответствующей указанному ID календаря.
   * 
   * @param calApiId ID календаря Outlook
   */
  leaveRoomByCalendarId(calApiId: string) {
    this.socket.emit("leave_calendar_room", calApiId);
  }


  /**
   * Запрашивает Outlook календари пользователя, после чего обрабатывает их.
   */
  callCalendars() {
    this.httpClient.get('https://graph.microsoft.com/v1.0/me/calendars')
      .subscribe(response => this.processCalendarsResponse(response));
  }

  /**
   * Преобразует ответ с полученными календарями Outlook, после чего сохраняет их и обновляет список календарей для выбора.
   * 
   * @param response Ответ от Microsoft Graph с календарями Outlook
   */
  processCalendarsResponse(response) {
    console.log(response);
    const rawCalendars: [] = response.value;
    this.calendarsList.length = 0;
    for (let i = 0; i < response.value.length; i++) {
      let calendarName: string = rawCalendars[i]['name'];
      if (rawCalendars[i]['isDefaultCalendar'] == true) {
        calendarName = "Собственный календарь";
      }
      const calendar = { cal_id: i, cal_name: calendarName, cal_api_id: rawCalendars[i]['id'] };
      this.calendarsList.push(calendar);
    }
    this.calendarDropdownElement.data = this.calendarsList;
  }

  /**
   * Метод, вызывающийся при выборе календаря в списке.
   * 
   * @param item Выбранный календарь
   */
  onDropdownSelect(item) {
    this.callEvents();
    const calendarApiId = this.getSelectedCalendarApiId(item);
    this.joinRoomByCalendarId(calendarApiId);
  }

  /**
   * Метод, вызывающийся при снятии выбора календаря в списке.
   * 
   * @param item Календарь, выбор которого был отменен
   */
  onDropdownDeselect(item) {
    this.callEvents();
    const calendarApiId = this.getSelectedCalendarApiId(item);
    this.leaveRoomByCalendarId(calendarApiId);
  }

  /**
   * Возвращает Outlook ID выбранного календаря.
   * 
   * @param selectedCalendar Выбранный календарь
   * @returns ID календаря Outlook
   */
  getSelectedCalendarApiId(selectedCalendar) {
    const selectedCalendarId = selectedCalendar['cal_id'];
    const calendarApiId = this.calendarsList[selectedCalendarId]['cal_api_id'];
    return calendarApiId;
  }

}
