import { Component, input, output } from '@angular/core';
import { MyReservationItem } from './reservation-api.service';

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
