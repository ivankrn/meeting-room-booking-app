import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css', './login-page.component.normalize.css']
})
export class LoginPageComponent implements OnInit {

  currentTime = Date.now();

  constructor(
    private msalService: MsalService, 
    private router: Router
  ) { 
    setInterval(() => this.currentTime = Date.now(), 60*1000);
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

  /**
   * Проверяет, авторизирован ли пользователь.
   * 
   * @returns true, если пользователь авторизирован, иначе false
   */
  isLoggedIn(): boolean {
    return this.msalService.instance.getActiveAccount() != null;
  }

  /**
   * Осуществляет авторизацию пользователя, используя редирект для входа через аккаунт Microsoft.
   */
  login() {
    this.msalService.loginRedirect();
  }

}
