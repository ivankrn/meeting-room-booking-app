import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CalendarEvent, CalendarView, CalendarDateFormatter, DAYS_OF_WEEK } from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { map, Observable, Subject, forkJoin, defaultIfEmpty } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { Socket } from 'ngx-socket-io';
import { SubscriptionInfo } from './subscription-info';
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

  /**
   * Разность между интервалом продления подписки и временем истечения подписки (необходима для того, чтобы запрос на продление подписки
   * успевал обработаться до истечения существующей подписки).
   */
  static readonly handicapInSeconds = 3;
  static readonly subscriptionLifetimeInMinutes = 1;
  static readonly backendNotificationHandlerUrl = "https://ffcf-185-42-144-194.eu.ngrok.io/listen";
  //static readonly backendNotificationHandlerUrl = "https://room-booking-app.run-eu-central1.goorm.io/listen";
  private readonly currentSubscriptions: Map<string, SubscriptionInfo> = new Map<string, SubscriptionInfo>();

  events: CalendarEvent[] = [];
  updated: Subject<void> = new Subject<void>();
  calendarsList = [];
  selectedCalendars = [];
  dropdownSettings: IDropdownSettings = {
    singleSelection: false,
    idField: 'cal_id',
    textField: 'cal_name',
    selectAllText: 'Выбрать все переговорные',
    unSelectAllText: 'Сбросить выделение',
    itemsShowLimit: 3,
  };
  @ViewChild('calendarDropdown')
  calendarDropdownElement;

  constructor(private httpClient: HttpClient, private msalService: MsalService, private socket: Socket, private cdr: ChangeDetectorRef) {
    setInterval(() => {
      this.currentTime = Date.now();
      this.cdr.detectChanges();
    }, 60 * 1000);
  }

  ngOnInit(): void {
    this.callCalendars();
    this.socket.on("schedule_update", () => this.callEvents());
    setInterval(() => this.updateSubs(), ScheduleComponent.subscriptionLifetimeInMinutes * 60 * 1000 - ScheduleComponent.handicapInSeconds * 1000);
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
    forkJoin(calendarsTasks).pipe(defaultIfEmpty(null)).subscribe(() => {this.updated.next(); console.log(`After call: ${this.events.length}`)})
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
   * Добавляет к дате время жизни подписки в минутах.
   * 
   * @param date - Дата, к которой необходимо добавить минуты.
   * @param deltaInMinutes - Количество минут, которое необходимо добавить.
   * @returns Дата с добавленным количеством минут.
   */
  addDeltaTimeInMinutes(date: Date, deltaInMinutes: number): Date {
    const newDate = new Date(date);
    newDate.setMinutes(newDate.getMinutes() + deltaInMinutes);
    return newDate;
  }

  /**
   * Создаёт подписку и возвращает информацию о ней.
   * 
   * @param calApiId ID календаря Microsoft Graph, на который мы хотим подписаться
   * @returns Информация о созданной подписке
   */
  createSub(calApiId: string): Observable<SubscriptionInfo> {
    const expirationDate = this.addDeltaTimeInMinutes(new Date(), ScheduleComponent.subscriptionLifetimeInMinutes);
    const subscription = {
      changeType: "created, updated, deleted",
      notificationUrl: ScheduleComponent.backendNotificationHandlerUrl,
      resource: `me/calendars/${calApiId}/events`,
      expirationDateTime: expirationDate.toISOString()
    };
    return this.httpClient.post("https://graph.microsoft.com/v1.0/subscriptions/", subscription)
      .pipe(map(response => {
        const subscriptionInfo = {
          subscriptionId: response['id'],
          expirationDate: expirationDate,
          resource: response['resource']
        };
        console.log(response);
        return subscriptionInfo;
      }))
  }

  /**
   * Удаляет подписку.
   * 
   * @param subscriptionId ID подписки, которую требуется удалить
   */
  deleteSub(subscriptionId: string) {
    this.httpClient.delete("https://graph.microsoft.com/v1.0/subscriptions/" + subscriptionId)
      .subscribe(() => this.currentSubscriptions.delete(subscriptionId));
  }

  /**
   * Продлевает старую подписку и обновляет информацию о ней.
   * 
   * @param oldSubscriptionInfo Информация старой подписки
   */
  updateSub(oldSubscriptionInfo: SubscriptionInfo) {
    console.log(`Old sub expiration time: ${oldSubscriptionInfo.expirationDate}`);
    const newExpirationTime = this.addDeltaTimeInMinutes(oldSubscriptionInfo.expirationDate, ScheduleComponent.subscriptionLifetimeInMinutes);
    const subscription = {
      expirationDateTime: newExpirationTime.toISOString()
    }
    this.httpClient.patch("https://graph.microsoft.com/v1.0/subscriptions/" + oldSubscriptionInfo.subscriptionId, subscription)
      .subscribe(response => {
        const subscriptionInfo = {
          subscriptionId: response['id'],
          expirationDate: newExpirationTime,
          resource: response['resource']
        };
        this.currentSubscriptions.set(subscriptionInfo.subscriptionId, subscriptionInfo);
      });
  }

  /**
   * Обновляет все текущие подписки.
   */
  updateSubs() {
    for (let subInfo of this.currentSubscriptions.values()) {
      this.updateSub(subInfo);
    }
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
    for (let i = 0; i < response.value.length; i++) {
      const calendar = { cal_id: i, cal_name: rawCalendars[i]['name'], cal_api_id: rawCalendars[i]['id'] };
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
    this.createSub(calendarApiId).subscribe(subInfo => this.currentSubscriptions.set(subInfo.subscriptionId, subInfo));
  }

  /**
   * Метод, вызывающийся при снятии выбора календаря в списке.
   * 
   * @param item Календарь, выбор которого был отменен
   */
  onDropdownDeselect(item) {
    this.callEvents();
    const calendarApiId = this.getSelectedCalendarApiId(item);
    for (let subInfo of this.currentSubscriptions.values()) {
      if (subInfo.resource == `me/calendars/${calendarApiId}/events`) {
        this.deleteSub(subInfo.subscriptionId);
      }
    }
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
