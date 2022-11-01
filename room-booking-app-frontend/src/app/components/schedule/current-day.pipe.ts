import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'currentDay',
  pure: true
})
export class CurrentDayPipe implements PipeTransform {
  transform(viewDate: Date, locale: string): any {
    return formatDate(viewDate, "EEEE, d MMMM", locale);
  }
}