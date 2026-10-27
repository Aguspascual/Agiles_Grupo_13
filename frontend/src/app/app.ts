import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ReservationModalComponent } from './create-match/reservation-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReservationModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
