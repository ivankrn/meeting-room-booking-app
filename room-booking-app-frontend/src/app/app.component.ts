import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'room-booking-app';
  apiResponse: string;

  constructor(private msalService: MsalService, private httpClient: HttpClient) {
  }

  ngOnInit(): void {
    this.msalService.instance.handleRedirectPromise().then(
      res => {
        if (res != null && res.account != null) {
          this.msalService.instance.setActiveAccount(res.account);
        }
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
      this.apiResponse = JSON.stringify(response);
    } )
  }

  callEvents() {
    this.httpClient.get('https://graph.microsoft.com/v1.0/me/events?$select=subject,organizer,start,end')
    .subscribe( response => this.apiResponse = JSON.stringify(response) );
  }

  callEcho() {
    this.httpClient.post('http://localhost:8080/echo', 'test').subscribe();
  }

  getTest() {
    this.httpClient.get('http://localhost:8080/getTest').subscribe( r => console.log(r) );
  }
}
