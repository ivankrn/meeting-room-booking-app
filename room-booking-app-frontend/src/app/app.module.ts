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
import { EventsService } from './services/events.service';
import { CurrentMonthPipe } from './components/schedule/current-month.pipe';
import { CurrentDayPipe } from './components/schedule/current-day.pipe';
import { LoginPageComponent } from './components/login-page/login-page.component';

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
  protectedResourceMap.set('http://localhost:8080/getTest', ['user.read', 'calendars.read']);
  return {
    interactionType: InteractionType.Popup,
    protectedResourceMap
  };
}

@NgModule({
  declarations: [
    AppComponent,
    ScheduleComponent,
    CurrentMonthPipe,
    CurrentDayPipe,
    LoginPageComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MsalModule,
    HttpClientModule,
    CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory })
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
    EventsService,
    {
      provide: LOCALE_ID,
      useValue: "ru"
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
