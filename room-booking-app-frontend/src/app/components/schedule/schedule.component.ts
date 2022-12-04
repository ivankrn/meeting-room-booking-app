import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CalendarEvent, CalendarView, CalendarDateFormatter, DAYS_OF_WEEK } from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { map, Observable, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { Socket } from 'ngx-socket-io';
import { SubscriptionInfo } from './subscription-info';

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
  static readonly backendNotificationHandlerUrl = "https://room-booking-app.run-eu-central1.goorm.io/listen";
  private currentSubscriptionInfo: SubscriptionInfo;

  events: CalendarEvent[] = [];
  updated: Subject<void> = new Subject<void>();

  constructor(private httpClient: HttpClient, private msalService: MsalService, private socket: Socket, private cdr: ChangeDetectorRef) {
    setInterval(() => {
      this.currentTime = Date.now();
      this.cdr.detectChanges();
    }, 60*1000);
  }

  ngOnInit(): void {
    this.callEvents();
    this.socket.on("schedule_update", () => this.callEvents());
    this.createSub().subscribe(subInfo => this.currentSubscriptionInfo = subInfo);
    setInterval( () => this.updateSub(this.currentSubscriptionInfo), ScheduleComponent.subscriptionLifetimeInMinutes * 60 * 1000 - ScheduleComponent.handicapInSeconds * 1000 )
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
   * Запрашивает список событий из календаря Outlook и по получении обрабатывает их.
   */
  callEvents() {
    this.httpClient.get('https://graph.microsoft.com/v1.0/me/events?$select=subject,organizer,start,end')
    .subscribe( response => this.processEventsResponse(response) );
  }


  /**
   * Преобразовывает ответ с полученными событиями из Outlook в нужный формат и сохраняет их, после
   * чего обновляет текущее расписание на экране.
   * 
   * @param response - Ответ от Microsoft Graph с событиями из Outlook
   */
  processEventsResponse(response) {
    const rawEvents: [] = response.value;
    this.events.length = 0;
    rawEvents.forEach(rawEvent => {
      const calendarEvent: CalendarEvent = {
        title: rawEvent['subject'],
        start: new Date(rawEvent['start']['dateTime'] + 'Z'),
        end: new Date(rawEvent['end']['dateTime'] + 'Z'),
        meta: {
          organizer: rawEvent['organizer']['emailAddress']['name'],
        },
      };
      this.events.push(calendarEvent);
    });
    this.updated.next();
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
  addDeltaTimeInMinutes(date: Date, deltaInMinutes: number) : Date {
    const newDate = new Date(date);
    newDate.setMinutes(newDate.getMinutes() + deltaInMinutes);
    return newDate;
  }

  /**
   * Создаёт подписку и возвращает информацию о ней, включая её id и дату окончания срока действия.
   * 
   * @returns Информация о созданной подписке
   */
  createSub() : Observable<SubscriptionInfo> {
    const expirationDate = this.addDeltaTimeInMinutes(new Date(), ScheduleComponent.subscriptionLifetimeInMinutes);
    const subscription = {
      changeType: "created, updated, deleted",
      notificationUrl: ScheduleComponent.backendNotificationHandlerUrl,
      resource: "me/events",
      expirationDateTime: expirationDate.toISOString()
    };
    return this.httpClient.post("https://graph.microsoft.com/v1.0/subscriptions/", subscription)
    .pipe(map(response => {
      const subscriptionInfo = {
        subscriptionId: response['id'],
        expirationDate: expirationDate
      };
      console.log(subscriptionInfo);
      return subscriptionInfo;
    }))
  }

  /**
   * Продлевает старую подписку и обновляет информацию о текущей подписке.
   * 
   * @param oldSubscriptionInfo Информация старой подписки
   */
  updateSub(oldSubscriptionInfo: SubscriptionInfo) {
    const newExpirationTime = this.addDeltaTimeInMinutes(oldSubscriptionInfo['expirationDate'], ScheduleComponent.subscriptionLifetimeInMinutes);
    const subscription = {
      expirationDateTime: newExpirationTime.toISOString()
    }
    this.httpClient.patch("https://graph.microsoft.com/v1.0/subscriptions/" + oldSubscriptionInfo['subscriptionId'], subscription)
    .subscribe(response => {
      const subscriptionInfo = {
        subscriptionId: response['id'],
        expirationDate: newExpirationTime
      };
      this.currentSubscriptionInfo = subscriptionInfo;
    });
  }

}
