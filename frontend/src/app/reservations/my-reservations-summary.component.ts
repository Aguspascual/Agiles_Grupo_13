import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyReservationItem } from './reservation-api.service';

const MINUTE_MS = 60_000;

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

  private readonly now = signal(Date.now());
  /** Tiempo que falta para el próximo turno, o null si ya empezó. */
  readonly countdown = computed(() => {
    const item = this.next();
    if (!item) return null;
    const minutes = Math.floor((new Date(item.startsAt).getTime() - this.now()) / MINUTE_MS);
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    const days = Math.floor(minutes / 1440);
    const pad = (value: number) => String(value).padStart(2, '0');
    return { days, clock: `${pad(Math.floor((minutes % 1440) / 60))}:${pad(minutes % 60)}` };
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}