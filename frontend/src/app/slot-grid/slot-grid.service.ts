import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { generateAvailabilitySlots } from '../availability/availability-generator';
import { BookingPreviewStore } from '../bookings/booking-preview.store';
import { ComplexPreviewStore } from '../complexes/complex-preview.store';
import { buildDayGrid } from './slot-grid.builder';
import { DEMO_COURTS, demoScheduleFor } from './demo-schedule';
import { DayGrid } from './slot-grid.model';

/** Reloj inyectable para poder probar turnos pasados. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

export type DayGridResult = { status: 'ok'; grid: DayGrid } | { status: 'not-found' };

/**
 * Fuente de la grilla de turnos. Hoy arma la respuesta con los datos locales de demostración;
 * cuando exista `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD` (ver
 * `docs/contracts/hu-05-grilla-de-turnos.md`) se reemplaza el cuerpo de `dayGrid` por la llamada
 * HTTP sin cambiar las pantallas, porque ya consumen un `Observable`.
 */
@Injectable({ providedIn: 'root' })
export class SlotGridService {
  private readonly complexes = inject(ComplexPreviewStore);
  private readonly bookings = inject(BookingPreviewStore);
  private readonly now = inject(CLOCK);

  dayGrid(complexId: string, date: Date): Observable<DayGridResult> {
    const complex = this.complexes.complexes().find((item) => item.id === complexId);
    if (!complex) return of({ status: 'not-found' });

    const grid = buildDayGrid({
      complex: { id: complex.id, name: complex.name, address: complex.address, zone: complex.zone },
      courts: DEMO_COURTS.filter((court) => court.complexId === complex.id).map(({ id, name, covered }) => ({ id, name, covered })),
      date,
      now: this.now(),
      slotsFor: (courtId, day) => generateAvailabilitySlots(courtId, demoScheduleFor(courtId), day, new Set()),
      bookingFor: (slot) => this.bookings.bookingFor(slot),
    });
    return of({ status: 'ok', grid });
  }
}
