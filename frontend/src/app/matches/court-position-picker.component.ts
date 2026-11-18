import { Component, EventEmitter, Input, Output } from '@angular/core';
import { courtRow } from './court-layout';

interface CourtSpot {
  slot: number;
  side: 'Drive' | 'Revés';
  pair: 'A' | 'B';
}

/** Cancha de pádel para elegir el lugar en el que se juega: pareja A o B, lado drive o revés. */
@Component({
  selector: 'app-court-position-picker',
  templateUrl: './court-position-picker.component.html',
  styleUrl: './court-position-picker.component.scss',
})
export class CourtPositionPickerComponent {
  @Input() value: number | null = null;
  @Input() initials = 'Vos';
  @Input() occupants: Array<{ slot: number; name: string }> = [];
  @Output() valueChange = new EventEmitter<number>();

  readonly spots: CourtSpot[] = [
    { slot: 1, side: 'Drive', pair: 'A' },
    { slot: 2, side: 'Revés', pair: 'A' },
    { slot: 3, side: 'Drive', pair: 'B' },
    { slot: 4, side: 'Revés', pair: 'B' },
  ];

  choose(slot: number): void {
    this.valueChange.emit(slot);
  }

  labelFor(slot: CourtSpot): string {
    if (this.value === null) return `Elegir tu lugar, Pareja ${slot.pair}, ${slot.side}`;
    if (this.value === slot.slot) return `Tu lugar, Pareja ${slot.pair}, ${slot.side}`;
    const occupant = this.occupants.find((item) => item.slot === slot.slot);
    return occupant ? `Quitar a ${occupant.name} de Pareja ${slot.pair}, ${slot.side}` : `Agregar amigo en Pareja ${slot.pair}, ${slot.side}`;
  }

  /** Fila del lugar en la cancha: el drive queda a la derecha de cada pareja. */
  rowFor(spot: CourtSpot): number {
    return courtRow(spot.pair, spot.side);
  }

  occupantFor(slot: number): string {
    return this.occupants.find((item) => item.slot === slot)?.name ?? '';
  }

  get summary(): string {
    const spot = this.spots.find((item) => item.slot === this.value);
    return spot ? `Pareja ${spot.pair} · ${spot.side}` : 'Elegí tu lugar en la cancha';
  }
}
