import { Component, input, output } from '@angular/core';
import { MyReservationItem } from './reservation-api.service';

const FALLBACK_IMAGE = '/images/cancha-interior.jpg';

@Component({
  selector: 'app-my-reservation-card',
  templateUrl: './my-reservation-card.component.html',
  styleUrl: './my-reservation-card.component.scss',
})
export class MyReservationCardComponent {
  readonly item = input.required<MyReservationItem>();
  readonly date = input.required<string>();
  readonly time = input.required<string>();
  readonly saving = input(false);
  readonly cancel = output<MyReservationItem>();
  readonly leave = output<MyReservationItem>();

  /** Foto de la cancha que cargó el complejo; si no tiene, se usa una imagen genérica. */
  imageSrc(): string {
    return `/api/v1/public/courts/${encodeURIComponent(this.item().court.id)}/image`;
  }

  useFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(FALLBACK_IMAGE)) image.src = FALLBACK_IMAGE;
  }

  canLeave(): boolean {
    const item = this.item();
    return item.kind === 'match' && item.status === 'reserved' &&
      new Date(item.startsAt).getTime() - Date.now() >= 2 * 60 * 60 * 1000;
  }

  isLeaveExpired(): boolean {
    const item = this.item();
    return item.kind === 'match' && item.status === 'reserved' && !this.canLeave();
  }

  typeLabel(): string {
    return this.item().kind === 'match' ? 'Partido abierto' : 'Reserva';
  }

  statusLabel(): string {
    const item = this.item();
    if (item.kind === 'reservation') return item.status === 'cancelled' ? 'Cancelada' : 'Reservada';
    if (item.status === 'cancelled') return 'Cancelado';
    if (item.match?.status === 'full') return 'Completo';
    return `Buscando jugadores · faltan ${item.match?.missingPlayers ?? 0}`;
  }
}
