import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthSessionService } from './auth/auth-session.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor() {
    inject(AuthSessionService).restore().subscribe({ error: () => undefined });
  }
}
