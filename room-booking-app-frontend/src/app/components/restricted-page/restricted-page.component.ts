import { Component, OnInit } from '@angular/core';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-restricted-page',
  templateUrl: './restricted-page.component.html',
  styleUrls: ['./restricted-page.component.css']
})
export class RestrictedPageComponent implements OnInit {

  constructor(private msalService: MsalService) { }

  ngOnInit(): void {
  }

  getUserName(): string {
    return this.msalService.instance.getActiveAccount().name;
  }
}
