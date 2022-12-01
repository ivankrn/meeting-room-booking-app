import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { CalendarView } from 'angular-calendar';
import { startOfWeek, endOfWeek } from 'date-fns';

@Pipe({
  name: 'currentViewDate',
  pure: true
})
export class CurrentViewDatePipe implements PipeTransform {

  transform(viewDate: Date, view: CalendarView, locale: string): any {
    if (view == CalendarView.Day) {
      return formatDate(viewDate, "EEEE, d MMMM", locale);
    } else if (view == CalendarView.Week) {
      const startOfWeekFormatted = formatDate(startOfWeek(viewDate), 'd MMM', locale);
      const endOfWeekFormatted = formatDate(endOfWeek(viewDate), 'd MMM', locale);
      const currentYear = viewDate.getFullYear();
      return `${startOfWeekFormatted} - ${endOfWeekFormatted}, ${currentYear}`;
    } else {
      return viewDate.toLocaleString(locale, {month: "long"});
    }
  }

}
