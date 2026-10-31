import { Component, EventEmitter, Input, Output } from '@angular/core';

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

  get summary(): string {
    const spot = this.spots.find((item) => item.slot === this.value);
    return spot ? `Pareja ${spot.pair} · ${spot.side}` : 'Elegí tu lugar en la cancha';
  }
}