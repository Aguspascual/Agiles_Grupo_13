import { layoutFor, placementFor } from './slot-grid.builder';
import { GridCourt, GridSlot } from './slot-grid.model';

describe('HU-05: disposición de la grilla de turnos', () => {
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
