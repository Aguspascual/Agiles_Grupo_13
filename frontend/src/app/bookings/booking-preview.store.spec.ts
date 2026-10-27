import { BookingPreviewStore, demoBookingFor, SlotRef } from './booking-preview.store';
import { ReservationGroup } from './booking.model';

function ref(courtId: string, date: string, startsAt: string) {
  return { id: `${courtId}:${date}:${startsAt}`, courtId, date, startsAt };
}

describe('HU-05: reservas de demostración', () => {
  const slots = Array.from({ length: 30 }, (_, day) =>
    ['08:00', '09:30', '11:00', '18:30', '20:00', '21:30'].map((time) =>
      ref('court-gonnet-1', `2026-11-${String(day + 1).padStart(2, '0')}`, time),
    ),
  ).flat();

  it('devuelve siempre el mismo estado para el mismo turno', () => {
    for (const slot of slots.slice(0, 20)) {
      expect(demoBookingFor(slot)).toEqual(demoBookingFor(slot));
    }
  });

  it('mezcla turnos libres, reservados, partidos abiertos y clases con más ocupación a la noche', () => {
    const results = slots.map((slot) => ({ slot, booking: demoBookingFor(slot) }));
    const kinds = new Set(results.map(({ booking }) => booking?.kind ?? 'free'));
    const occupancy = (evening: boolean) => {
      const group = results.filter(({ slot }) => slot.startsAt >= '18:00' === evening);
      return group.filter(({ booking }) => booking).length / group.length;
    };

    expect(kinds).toEqual(new Set(['free', 'full', 'pending', 'class']));
    expect(occupancy(true)).toBeGreaterThan(occupancy(false));
  });

  it('informa cuántos jugadores faltan y el nivel buscado en los partidos abiertos', () => {
    const pending = slots.map(demoBookingFor).filter((booking) => booking?.kind === 'pending');

    expect(pending.length).toBeGreaterThan(0);
    for (const booking of pending) {
      expect([1, 2, 3]).toContain(booking?.pendingMatch?.missingPlayers);
      expect(booking?.pendingMatch?.level).toMatch(/^\d(ra|da|ta|ma|va)$/);
    }
  });
});

describe('HU-06: reserva local con grupo completo', () => {
  const group: ReservationGroup = {
    responsibleName: 'Ana Martínez',
    contactPhone: '221 555-0101',
    players: ['Ana Martínez', 'Mateo Ruiz', 'Lucía Díaz', 'Juan Pérez'],
  };

  function availableSlot(): SlotRef {
    for (let index = 0; index < 1000; index += 1) {
      const slot = ref('court-hu06', '2026-11-10', `${String(8 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`);
      if (!demoBookingFor(slot)) return slot;
    }
    throw new Error('No se encontró un slot libre de demostración.');
  }

  it('registra la reserva y expone el grupo junto al contacto', () => {
    const store = new BookingPreviewStore();
    const slot = availableSlot();

    const result = store.reserve(slot, group);

    expect(result.status).toBe('created');
    expect(store.bookingFor(slot)).toMatchObject({
      kind: 'full',
      holderName: group.responsibleName,
      holderPhone: group.contactPhone,
      reservation: group,
    });
  });

  it('rechaza un segundo intento para el mismo slot sin reemplazar la reserva', () => {
    const store = new BookingPreviewStore();
    const slot = availableSlot();
    const first = store.reserve(slot, group);
    const second = store.reserve(slot, { ...group, responsibleName: 'Otra persona' });

    expect(first.status).toBe('created');
    expect(second).toEqual({ status: 'conflict' });
    expect(store.bookingFor(slot)).toMatchObject({ holderName: group.responsibleName });
  });

  it('no reemplaza un turno ya ocupado por los datos de demostración', () => {
    const store = new BookingPreviewStore();
    const occupied = Array.from({ length: 100 }, (_, index) =>
      ref(`court-demo-${index}`, '2026-11-10', '20:00'),
    ).find((slot) => demoBookingFor(slot));
    expect(occupied).toBeDefined();

    expect(store.reserve(occupied!, group)).toEqual({ status: 'conflict' });
  });
});
