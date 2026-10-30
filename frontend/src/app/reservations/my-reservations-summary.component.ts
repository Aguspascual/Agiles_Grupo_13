import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyReservationItem } from './reservation-api.service';

@Component({
  selector: 'app-my-reservations-summary',
  imports: [RouterLink],
  templateUrl: './my-reservations-summary.component.html',
  styleUrl: './my-reservations-summary.component.scss',
})
export class MyReservationsSummaryComponent {
  readonly next = input<MyReservationItem | null>(null);
  readonly nextDate = input('');
  readonly nextTime = input('');
  readonly reservations = input(0);
  readonly matches = input(0);
  readonly cancelled = input(0);
  readonly loaded = input(0);
}
