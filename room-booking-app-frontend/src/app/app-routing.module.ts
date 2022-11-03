import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginPageComponent } from './components/login-page/login-page.component';
import { ScheduleComponent } from './components/schedule/schedule.component';
import { MsalGuard } from './guards/msal.guard';

const routes: Routes = [
  {
    path: 'login', component: LoginPageComponent
  },
  {
    path: 'schedule', component: ScheduleComponent, canActivate: [MsalGuard]
  },
  {
    path: '**', component: LoginPageComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
