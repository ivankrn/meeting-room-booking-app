import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CalendarEvent, CalendarView, CalendarDateFormatter, DAYS_OF_WEEK } from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { Socket } from 'ngx-socket-io';

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

  events: CalendarEvent[] = [];
  updated: Subject<void> = new Subject<void>();

  constructor(private httpClient: HttpClient, private msalService: MsalService, private socket: Socket) {}

  ngOnInit(): void {
    this.callEvents();
    this.socket.on("schedule_update", () => this.callEvents());
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

  createSub() {
    let now = new Date();
    const deltaTimeInMinutes = 1;
    now.setMinutes(now.getMinutes() + deltaTimeInMinutes);
    now = new Date(now);
    const subscription = {
      changeType: "created, updated, deleted",
      notificationUrl: "https://c13d-185-42-144-194.eu.ngrok.io/listen",
      resource: "me/events",
      expirationDateTime: now.toISOString()
    };
    this.httpClient.post("https://graph.microsoft.com/v1.0/subscriptions/", subscription)
    .subscribe(response => {
      console.log(response);
      setTimeout(() => this.notifyAboutSubDeactivation(), deltaTimeInMinutes * 60 * 1000);
    });
  }

  listSubs() {
    this.httpClient.get("https://graph.microsoft.com/v1.0/subscriptions/").subscribe(r => console.log(r));
  }

  notifyAboutSubDeactivation() {
    this.httpClient.post("http://localhost:8080/deactivateSubscription", "").subscribe();
  }

}
