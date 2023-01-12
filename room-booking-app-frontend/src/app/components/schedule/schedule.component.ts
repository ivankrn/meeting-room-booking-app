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

  currentTime = Date.now();

  locale: string = "ru";
  weekStartsOn: number = DAYS_OF_WEEK.MONDAY;
  dayStartHour: number = 6;
  dayEndHour: number = 20;

  static readonly backendNotificationHandlerUrl = "http://localhost:8080";

  events: CalendarEvent[] = [];
  updated: Subject<void> = new Subject<void>();
  calendarsList = [];
  selectedCalendars = [];
  dropdownSelectText = "Выбрать переговорную";
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
    this.socket.on("add_event", e => {
      const calendarEvent: CalendarEvent = ScheduleComponent.getCalendarEventFromSocketNotification(e);
      this.events.push(calendarEvent);
      this.updateEvents();
    });
    this.socket.on("update_event", e => {
      const calendarEvent: CalendarEvent = ScheduleComponent.getCalendarEventFromSocketNotification(e);
      for (let i = 0; i < this.events.length; i++) {
        if (this.events[i].id == calendarEvent.id) {
          this.events[i] = calendarEvent;
        }
      }
      this.updateEvents();
    })
    this.socket.on("delete_event", eventId => {
      for (let i = 0; i < this.events.length; i++) {
        if (this.events[i].id == eventId) {
          this.events.splice(i, 1);
          this.updateEvents();
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
    .pipe(map(authResult => this.httpClient.post(ScheduleComponent.backendNotificationHandlerUrl + "/token", 
    {userId: authResult.account.localAccountId, accessToken: authResult.accessToken}).subscribe()))
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
   * Меняет фон кнопки при выборе временного диапазона
   * @param event - Кнопка
   */
  changeColor(event) {
    const headerButtons = document.querySelectorAll('.header__button');
    headerButtons.forEach((button) => {
      button.classList.remove('btn-active');
    })
    event.target.classList.add('btn-active');
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
    forkJoin(calendarsTasks).pipe(defaultIfEmpty(null)).subscribe(() => this.updateEvents());
  }

  /**
   * Очищает текущий список событий.
   */
  clearEvents() {
    this.events.length = 0;
  }

  /**
   * Вызывает обновление отображаемого списка событий.
   */
  updateEvents() {
    this.updated.next();
  }

  /**
   * Преобразовывает ответ с полученными событиями из Outlook в нужный формат и сохраняет их.
   *
   * @param response - Ответ от Microsoft Graph с событиями из Outlook
   */
  processEventsResponse(response) {
    const rawEvents: [] = response.value;
    rawEvents.forEach(rawEvent => {
      const calendarEvent: CalendarEvent = ScheduleComponent.getCalendarEventFromOutlookRawEvent(rawEvent);
      this.events.push(calendarEvent);
    });
  }

  /**
   * Преобразует ответ с полученным событием из Outlook и возвращает его в нужном формате.
   *
   * @param rawEvent Ответ от Microsoft Graph с событием из Outlook
   * @returns Событие в календаре
   */
  static getCalendarEventFromOutlookRawEvent(rawEvent): CalendarEvent {
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
   * Преобразует socket событие и возвращает его в нужном формате.
   * 
   * @param socketEventNotification Socket событие
   * @returns Событие в календаре
   */
  static getCalendarEventFromSocketNotification(socketEventNotification): CalendarEvent {
    const calendarEvent: CalendarEvent = {
      id: socketEventNotification["id"],
      title: socketEventNotification["subject"],
      start: new Date(socketEventNotification["start"] + 'Z'),
      end: new Date(socketEventNotification["end"] + "Z"),
      meta: {
        organizer: socketEventNotification["organizer"],
      }
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
    const data = {userId: this.msalService.instance.getActiveAccount().localAccountId, calApiId: calApiId};
    this.socket.emit("join_calendar_room", JSON.stringify(data));

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
    const rawCalendars: [] = response.value;
    this.calendarsList.length = 0;
    let i = 0;
    rawCalendars.forEach(rawCalendar => {
      let calendarName: string = rawCalendar['name'];
      if (calendarName != "Дни рождения") { // не обрабатываем календарь дней рождения, т.к. в нем наврядли содержится расписание переговорных
        if (rawCalendar['isDefaultCalendar']) {
          calendarName = "Собственный календарь";
        }
        const calendar = { cal_id: i, cal_name: calendarName, cal_api_id: rawCalendar['id'] };
        this.calendarsList.push(calendar);
        i++;
      }
    });
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
   * Метод, вызывающийся при одномоментном выборе всех календарей в списке.
   */
  onDropdownSelectAll() {
    setTimeout(() => {
      this.callEvents();
      this.selectedCalendars.forEach(selectedCal => {
        const calendarApiId = this.getSelectedCalendarApiId(selectedCal);
        this.joinRoomByCalendarId(calendarApiId);
      });
    }, 100);
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
   * Метод, вызывающийся при одномоментном снятии выбора со всех календарей в списке.
   */
  onDropdownDeselectAll() {
    setTimeout(() => {
      this.callEvents();
      this.calendarsList.forEach(calendar => {
        const calendarApiId = calendar['cal_api_id'];
        this.leaveRoomByCalendarId(calendarApiId);
      });
    }, 100);
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
