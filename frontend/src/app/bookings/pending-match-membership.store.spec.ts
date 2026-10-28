import { PendingMatchMembershipStore } from './pending-match-membership.store';

describe('HU-13: baja de un partido pendiente', () => {
  it('inicia con la participación del jugador actual en un partido completo', () => {
    const store = new PendingMatchMembershipStore();
    expect(store.membership().players).toHaveLength(4);
    expect(store.membership().openSpots).toBe(0);
  });

  it('al bajarse libera un lugar y el partido vuelve a estar pendiente', () => {
    const store = new PendingMatchMembershipStore();
    store.leave();
    expect(store.membership().players).toHaveLength(3);
    expect(store.membership().openSpots).toBe(1);
  });
});
