import { courtRow } from './court-layout';

describe('ubicación de drive y revés en la cancha', () => {
  it('pone el drive de la pareja A abajo y su revés arriba', () => {
    expect(courtRow('A', 'Drive')).toBe(2);
    expect(courtRow('A', 'Revés')).toBe(1);
  });

  it('pone el drive de la pareja B arriba y su revés abajo', () => {
    expect(courtRow('B', 'Drive')).toBe(1);
    expect(courtRow('B', 'Revés')).toBe(2);
  });
});
