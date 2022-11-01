import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CalendarEvent, CalendarView, CalendarDateFormatter, DAYS_OF_WEEK } from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { setHours, setMinutes } from 'date-fns';
import { EventsService } from 'src/app/services/events.service';
import { Subject } from 'rxjs';
import { formatDate } from '@angular/common';

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

  // events: CalendarEvent[] = [
  //   {
  //     title: "Some event",
  //     start: setHours(setMinutes(new Date(), 0), 7),
  //     end: setHours(setMinutes(new Date(), 45), 7)
  //   },
  // ]
  events: CalendarEvent[];
  updated: Subject<void>;

  constructor(private eventsService: EventsService) {
    this.events = this.eventsService.events;
    this.updated = this.eventsService.updated;
  }

  ngOnInit(): void {
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

  printDate() {
    console.log(this.viewDate);
  }

}
