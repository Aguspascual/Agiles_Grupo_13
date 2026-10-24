import { demoBookingFor } from './booking-preview.store';

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
