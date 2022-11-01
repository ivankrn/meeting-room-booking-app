import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'currentMonth',
  pure: true
})
export class CurrentMonthPipe implements PipeTransform {
  transform(viewDate: Date, locale: string): any {
    return viewDate.toLocaleString(locale, {month: "long"});
  }
}