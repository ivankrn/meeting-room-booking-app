import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicPageComponent } from './components/public-page/public-page.component';
import { ScheduleComponent } from './components/schedule/schedule.component';
import { MsalGuard } from './guards/msal.guard';

const routes: Routes = [
  {
    path: 'public-page', component: PublicPageComponent
  },
  {
    path: 'schedule', component: ScheduleComponent, canActivate: [MsalGuard]
  },
  {
    path: '**', component: PublicPageComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
