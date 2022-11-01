import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EventsService {

  events: CalendarEvent[] = [];
  updated = new Subject<void>();
  
}
