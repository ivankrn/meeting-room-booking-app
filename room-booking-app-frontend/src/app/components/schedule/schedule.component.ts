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

  view: CalendarView = CalendarView.Week;
  viewDate: Date = new Date();

  currentTime = Date.now();

  locale: string = "ru";
  weekStartsOn: number = DAYS_OF_WEEK.MONDAY;
  dayStartHour: number = 6;
  dayEndHour: number = 20;

  static readonly handicapInSeconds = 3;
  static readonly subscriptionDeltaTimeInMinutes = 1;
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
    setInterval( () => this.updateSub(this.currentSubscriptionInfo), ScheduleComponent.subscriptionDeltaTimeInMinutes * 60 * 1000 - ScheduleComponent.handicapInSeconds * 1000 )
  }

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

  callEvents() {
    this.httpClient.get('https://graph.microsoft.com/v1.0/me/events?$select=subject,organizer,start,end')
    .subscribe( response => this.processEventsResponse(response) );
  }


  processEventsResponse(response) {
    const rawEvents: [] = response.value;
    this.events.length = 0;
    rawEvents.forEach(rawEvent => {
      const calendarEvent: CalendarEvent = {
        title: rawEvent['subject'],
        start: new Date(rawEvent['start']['dateTime'] + 'Z'),
        end: new Date(rawEvent['end']['dateTime'] + 'Z')
      };
      this.events.push(calendarEvent);
    });
    this.updated.next();
  }

  logout() {
    this.msalService.logout();
  }

  addDeltaTimeInMinutes(date: Date) : Date {
    const newDate = new Date(date);
    newDate.setMinutes(newDate.getMinutes() + ScheduleComponent.subscriptionDeltaTimeInMinutes);
    return newDate;
  }

  createSub() : Observable<SubscriptionInfo> {
    const expirationDate = this.addDeltaTimeInMinutes(new Date());
    const subscription = {
      changeType: "created, updated, deleted",
      notificationUrl: "https://ba01-185-42-144-194.eu.ngrok.io/listen",
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

  updateSub(oldSubscription: SubscriptionInfo) {
    const newExpirationTime = this.addDeltaTimeInMinutes(oldSubscription['expirationDate']);
    const subscription = {
      expirationDateTime: newExpirationTime.toISOString()
    }
    this.httpClient.patch("https://graph.microsoft.com/v1.0/subscriptions/" + oldSubscription['subscriptionId'], subscription)
    .subscribe(response => {
      console.log("Updated");
      console.log(response);
      const subscriptionInfo = {
        subscriptionId: response['id'],
        expirationDate: newExpirationTime
      };
      this.currentSubscriptionInfo = subscriptionInfo;
    });
  }

  listSubs() {
    this.httpClient.get("https://graph.microsoft.com/v1.0/subscriptions/").subscribe(r => console.log(r));
  }

}
