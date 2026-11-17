import { MatchPreview } from './landing.data';
import { isUrgentMatch } from './urgent-match';

const baseMatch: MatchPreview = {
  id: 'match-1',
  date: '2026-11-18',
  startsAt: '13:00',
  day: 'Mañana',
  time: '12:00 hs',
  duration: '90 min',
  club: 'Club de prueba',
  courtName: 'Cancha 1',
  image: '',
  imageAlt: '',
  address: 'Dirección de prueba',
  zone: 'Gonnet',
  level: '5ta',
  price: '',
  openSpots: 2,
  players: [],
  features: [],
};

describe('isUrgentMatch', () => {
  const now = new Date('2026-11-18T12:00:00-03:00');

  it.each([
    [0, false],
    [1, true],
    [2, true],
    [3, false],
  ])('solo considera 1 o 2 lugares libres (lugares: %i)', (openSpots, expected) => {
    expect(isUrgentMatch({ ...baseMatch, openSpots }, now)).toBe(expected);
  });

  it('excluye partidos que empiezan ahora o que ya comenzaron', () => {
    expect(isUrgentMatch({ ...baseMatch, date: '2026-11-18', startsAt: '12:00' }, now)).toBe(false);
    expect(isUrgentMatch({ ...baseMatch, date: '2026-11-18', startsAt: '11:59' }, now)).toBe(false);
  });

  it('incluye el límite exacto de 24 horas y excluye cualquier instante posterior', () => {
    expect(isUrgentMatch({ ...baseMatch, date: '2026-11-19', startsAt: '12:00' }, now)).toBe(true);
    expect(isUrgentMatch({ ...baseMatch, date: '2026-11-19', startsAt: '12:01' }, now)).toBe(false);
  });

  it('calcula la ventana móvil al cruzar la medianoche', () => {
    const lateNight = new Date('2026-11-18T23:30:00-03:00');
    expect(isUrgentMatch({ ...baseMatch, date: '2026-11-19', startsAt: '00:15' }, lateNight)).toBe(true);
    expect(isUrgentMatch({ ...baseMatch, date: '2026-11-19', startsAt: '23:31' }, lateNight)).toBe(false);
  });

  it('interpreta la hora como Buenos Aires aunque el navegador use otra zona', () => {
    const match = { ...baseMatch, date: '2026-11-18', startsAt: '13:00' };
    expect(isUrgentMatch(match, new Date('2026-11-18T15:00:00Z'))).toBe(true);
  });

  it('excluye fechas, horas ausentes o inválidas', () => {
    expect(isUrgentMatch({ ...baseMatch, date: undefined }, now)).toBe(false);
    expect(isUrgentMatch({ ...baseMatch, startsAt: undefined }, now)).toBe(false);
    expect(isUrgentMatch({ ...baseMatch, date: '2026-02-30' }, now)).toBe(false);
    expect(isUrgentMatch({ ...baseMatch, startsAt: '25:00' }, now)).toBe(false);
  });
});
