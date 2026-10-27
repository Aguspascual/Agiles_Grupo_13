import { AvailabilitySlot } from '../availability/availability.model';
import { BookingRecord } from '../bookings/booking.model';
import { BookingPreviewStore, demoBookingFor } from '../bookings/booking-preview.store';
import { buildDayGrid, hasStarted, layoutFor, placementFor } from './slot-grid.builder';
import { GridCourt, GridSlot } from './slot-grid.model';

const complex = { id: 'complex-1', name: 'Club de prueba', address: 'Calle 1', zone: 'Gonnet' };
const date = new Date(2026, 9, 23, 12);

function slot(
  courtId: string,
  startsAt: string,
  endsAt: string,
  status: AvailabilitySlot['status'] = 'available',
): AvailabilitySlot {
  return {
    id: `${courtId}:2026-10-23:${startsAt}`,
    courtId,
    date: '2026-10-23',
    startsAt,
    endsAt,
    status,
  };
}

function booking(slotId: string, kind: BookingRecord['kind']): BookingRecord {
  return {
    id: `b-${slotId}`,
    slotId,
    courtId: 'court-1',
    date: '2026-10-23',
    startsAt: slotId.slice(-5),
    kind,
    holderName: 'Juan Pérez',
    holderPhone: '221 555-0101',
    pendingMatch: kind === 'pending' ? { missingPlayers: 2, level: '5ta' } : undefined,
  };
}

describe('HU-05: armado de la grilla de turnos', () => {
  it('muestra como reservado un slot creado con el store de HU-06', () => {
    const store = new BookingPreviewStore();
    const candidate = Array.from({ length: 100 }, (_, index) => slot(
      'court-1', `${String(8 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
      `${String(9 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
    )).find((item) => !demoBookingFor(item));
    expect(candidate).toBeDefined();
    store.reserve(candidate!, {
      responsibleName: 'Ana Martínez', contactPhone: '221 555-0101',
      players: ['Ana Martínez', 'Mateo Ruiz', 'Lucía Díaz', 'Juan Pérez'],
    });

    const grid = buildDayGrid({
      complex,
      courts: [{ id: 'court-1', name: 'Cancha 1', covered: true }],
      date,
      now: new Date(2026, 9, 23, 9, 0),
      slotsFor: () => [candidate!],
      bookingFor: (ref) => store.bookingFor(ref),
    });

    expect(grid.courts[0].slots[0].state).toBe('reserved');
  });

  it('combina horarios, bloqueos, reservas y clases con la prioridad correcta', () => {
    const slots = [
      slot('court-1', '18:00', '19:30'),
      slot('court-1', '19:30', '21:00'),
      slot('court-1', '21:00', '22:30', 'blocked'),
      slot('court-1', '16:30', '18:00'),
      slot('court-1', '15:00', '16:30'),
    ];
    const bookings = new Map([
      [slots[0].id, booking(slots[0].id, 'full')],
      [slots[1].id, booking(slots[1].id, 'pending')],
      // Un bloqueo manda sobre cualquier reserva de ejemplo.
      [slots[2].id, booking(slots[2].id, 'full')],
      [slots[4].id, booking(slots[4].id, 'class')],
    ]);

    const grid = buildDayGrid({
      complex,
      courts: [{ id: 'court-1', name: 'Cancha 1', covered: true }],
      date,
      now: new Date(2026, 9, 23, 9, 0),
      slotsFor: () => slots,
      bookingFor: (ref) => bookings.get(ref.id) ?? null,
    });

    expect(grid.date).toBe('2026-10-23');
    expect(grid.courts[0].slots.map((item) => item.state)).toEqual([
      'reserved',
      'pending',
      'blocked',
      'available',
      'class',
    ]);
    expect(grid.courts[0].slots[1].pendingMatch).toEqual({ missingPlayers: 2, level: '5ta' });
    expect(grid.courts[0].slots[0].pendingMatch).toBeUndefined();
  });

  it('marca como pasados los turnos que ya empezaron', () => {
    const now = new Date(2026, 9, 23, 19, 0);

    expect(hasStarted('2026-10-23', '18:00', now)).toBe(true);
    expect(hasStarted('2026-10-23', '19:00', now)).toBe(true);
    expect(hasStarted('2026-10-23', '19:30', now)).toBe(false);
    expect(hasStarted('2026-10-24', '08:00', now)).toBe(false);
  });

  it('alinea turnos de 60 y 90 minutos en filas de 30 minutos', () => {
    const courts: GridCourt[] = [
      {
        id: 'a',
        name: 'Cancha 1',
        covered: true,
        slots: [gridSlot('a', '08:00', '09:30'), gridSlot('a', '09:30', '11:00')],
      },
      {
        id: 'b',
        name: 'Cancha 2',
        covered: false,
        slots: [gridSlot('b', '09:00', '10:00'), gridSlot('b', '10:00', '11:00')],
      },
    ];

    const layout = layoutFor(courts);

    expect(layout).toMatchObject({
      startMinute: 8 * 60,
      endMinute: 11 * 60,
      step: 30,
      rowCount: 6,
    });
    expect(layout?.hourMarks.map((mark) => mark.label)).toEqual(['08:00', '09:00', '10:00']);
    expect(placementFor(courts[0].slots[1], layout!)).toEqual({ row: 4, span: 3 });
    expect(placementFor(courts[1].slots[0], layout!)).toEqual({ row: 3, span: 2 });
  });

  it('usa filas más finas cuando un turno empieza fuera de la media hora', () => {
    const layout = layoutFor([
      { id: 'a', name: 'Cancha 1', covered: true, slots: [gridSlot('a', '08:15', '09:15')] },
    ]);

    expect(layout?.step).toBe(15);
    expect(placementFor(gridSlot('a', '08:15', '09:15'), layout!)).toEqual({ row: 2, span: 4 });
  });

  it('no arma filas cuando no hay turnos', () => {
    expect(layoutFor([{ id: 'a', name: 'Cancha 1', covered: true, slots: [] }])).toBeNull();
  });
});

function gridSlot(courtId: string, startsAt: string, endsAt: string): GridSlot {
  return {
    id: `${courtId}:${startsAt}`,
    courtId,
    date: '2026-10-23',
    startsAt,
    endsAt,
    state: 'available',
    isPast: false,
  };
}
