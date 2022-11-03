import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CalendarEvent, CalendarView, CalendarDateFormatter, DAYS_OF_WEEK } from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';

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

  locale: string = "ru";
  weekStartsOn: number = DAYS_OF_WEEK.MONDAY;
  dayStartHour: number = 6;
  dayEndHour: number = 18;

  events: CalendarEvent[] = [];
  updated: Subject<void> = new Subject<void>();

  constructor(private httpClient: HttpClient, private msalService: MsalService) {}

  ngOnInit(): void {
    this.callEvents();
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
    console.log(this.events);
    this.updated.next();
  }

  logout() {
    this.msalService.logout();
  }
}
