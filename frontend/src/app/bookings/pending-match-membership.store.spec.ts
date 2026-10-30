import { PendingMatchMembershipStore } from './pending-match-membership.store';

/** El partido de demostración es "Hoy · 20:30 hs". */
const at = (hours: number, minutes: number) => new Date(2026, 9, 29, hours, minutes);

describe('HU-13: baja de un partido pendiente', () => {
  it('inicia con la participación del jugador actual en un partido completo', () => {
    const store = new PendingMatchMembershipStore();
    expect(store.membership().players).toHaveLength(4);
    expect(store.membership().openSpots).toBe(0);
  });

  it('al bajarse libera un lugar y el partido vuelve a estar pendiente', () => {
    const store = new PendingMatchMembershipStore();
    store.leave(at(10, 0));
    expect(store.membership().players).toHaveLength(3);
    expect(store.membership().openSpots).toBe(1);
  });

  it('RN-03: a las 2 horas exactas todavía se puede bajar', () => {
    const store = new PendingMatchMembershipStore();
    expect(store.canLeave(at(18, 30))).toBe(true);
    store.leave(at(18, 30));
    expect(store.membership().players).toHaveLength(3);
  });

  it('RN-03: con menos de 2 horas no se puede bajar y el estado no cambia', () => {
    const store = new PendingMatchMembershipStore();
    expect(store.canLeave(at(18, 31))).toBe(false);
    store.leave(at(18, 31));
    expect(store.membership().players).toHaveLength(4);
    expect(store.membership().notice).toBe('');
  });

  it('RN-03: una vez iniciado el partido no se puede bajar', () => {
    const store = new PendingMatchMembershipStore();
    expect(store.canLeave(at(21, 0))).toBe(false);
  });
});
