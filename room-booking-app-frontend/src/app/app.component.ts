import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { Router } from '@angular/router';

import { CalendarEvent } from 'angular-calendar';
import { EventsService } from './services/events.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'room-booking-app';

  constructor(
    private msalService: MsalService, 
    private httpClient: HttpClient, 
    private eventsService: EventsService, 
    private router: Router) {
  }

  ngOnInit(): void {
    this.msalService.instance.handleRedirectPromise().then(
      res => {
        if (res != null && res.account != null) {
          this.msalService.instance.setActiveAccount(res.account);
        }
        this.router.navigate(["/schedule"]);
      }
    )
  }

  isLoggedIn(): boolean {
    return this.msalService.instance.getActiveAccount() != null;
  }

  login() {
    this.msalService.loginRedirect();
  }

  logout() {
    this.msalService.logout();
  }

  printDebug() {
    this.getTest();
  }

  callProfile() {
    this.httpClient.get('https://graph.microsoft.com/v1.0/me').subscribe( response => {
      console.log(JSON.stringify(response));
    } )
  }

  // callEvents() {
  //   this.httpClient.get('https://graph.microsoft.com/v1.0/me/events?$select=subject,organizer,start,end')
  //   .subscribe( response => this.apiResponse = JSON.stringify(response) );
  // }
  callEvents() {
    this.httpClient.get('https://graph.microsoft.com/v1.0/me/events?$select=subject,organizer,start,end')
    .subscribe( response => this.processEventsResponse(response) );
  }

  processEventsResponse(response) {
    const rawEvents: [] = response.value;
    this.eventsService.events.length = 0;
    rawEvents.forEach(rawEvent => {
      const calendarEvent: CalendarEvent = {
        title: rawEvent['subject'],
        start: new Date(rawEvent['start']['dateTime'] + 'Z'),
        end: new Date(rawEvent['end']['dateTime'] + 'Z')
      };
      this.eventsService.events.push(calendarEvent);
    });
    console.log(this.eventsService.events);
    this.eventsService.updated.next();
  }

  callEcho() {
    this.httpClient.post('http://localhost:8080/echo', 'test').subscribe();
  }

  getTest() {
    this.httpClient.get('http://localhost:8080/getTest').subscribe( r => console.log(r) );
  }
}
