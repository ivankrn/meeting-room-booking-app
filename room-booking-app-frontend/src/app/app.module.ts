import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MsalInterceptor, MsalInterceptorConfiguration, MsalModule, MsalService, MSAL_INSTANCE, MSAL_INTERCEPTOR_CONFIG } from '@azure/msal-angular';
import { InteractionType, IPublicClientApplication, PublicClientApplication } from '@azure/msal-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { ScheduleComponent } from './components/schedule/schedule.component';
import localeRu from '@angular/common/locales/ru';
import { registerLocaleData } from '@angular/common';
import { LoginPageComponent } from './components/login-page/login-page.component';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { CurrentViewDatePipe } from './components/schedule/current-view-date.pipe';

registerLocaleData(localeRu, 'ru');

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: '07b13f14-ddd5-478c-af9b-c9b533edeb84',
      redirectUri: 'http://localhost:4200',
      postLogoutRedirectUri: 'http://localhost:4200',
    }
  })
}

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  protectedResourceMap.set('https://graph.microsoft.com/v1.0/me', ['user.read', 'calendars.read']);
  protectedResourceMap.set('https://graph.microsoft.com/v1.0/subscriptions', ['user.read', 'calendars.read']);
  return {
    interactionType: InteractionType.Popup,
    protectedResourceMap
  };
}

//const socketIoConfig: SocketIoConfig = { url: 'http://localhost:4444', options: {} };
const socketIoConfig: SocketIoConfig = { url: 'room-booking-app.run-eu-central1.goorm.io', options: {} };

@NgModule({
  declarations: [
    AppComponent,
    ScheduleComponent,
    LoginPageComponent,
    CurrentViewDatePipe,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MsalModule,
    HttpClientModule,
    CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory }),
    SocketIoModule.forRoot(socketIoConfig),
  ],
  providers: [
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory
    },
    MsalService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory
    },
    {
      provide: LOCALE_ID,
      useValue: "ru"
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
