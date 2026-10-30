import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DayGridResult, SlotGridService } from './slot-grid.service';

const COMPLEX = 'c1';
const URL = `/api/v1/complexes/${COMPLEX}/slots`;
const DAY = new Date(2026, 9, 23, 12);

const body = {
  complex: { id: COMPLEX, name: 'Club', address: 'Calle 1', zone: 'Gonnet' },
  date: '2026-10-23',
  courts: [
    {
      id: 'court-1',
      name: 'Cancha 1',
      covered: true,
      occupiedIntervals: [{ originalStartsAt: '10:00' }],
      slots: [
        { id: 'court-1:2026-10-23:09:00', startsAt: '09:00', endsAt: '10:30', status: 'AVAILABLE', isPast: true },
        { id: 'court-1:2026-10-23:10:30', startsAt: '10:30', endsAt: '12:00', status: 'RESERVED', isPast: false },
        { id: 'court-1:2026-10-23:12:00', startsAt: '12:00', endsAt: '13:30', status: 'BLOCKED', isPast: false },
        { id: 'court-1:2026-10-23:13:30', startsAt: '13:30', endsAt: '15:00', status: 'CLASS', isPast: false },
      ],
    },
  ],
};

describe('HU-05: SlotGridService', () => {
  let service: SlotGridService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SlotGridService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(): { result: () => DayGridResult | undefined } {
    let result: DayGridResult | undefined;
    service.dayGrid(COMPLEX, DAY).subscribe((value) => (result = value));
    return { result: () => result };
  }

  it('consulta la URL exacta con el único parámetro date', () => {
    load();
    const req = http.expectOne((request) => request.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['date']);
    expect(req.request.params.get('date')).toBe('2026-10-23');
    req.flush(body);
  });

  it('mapea estados, usa isPast del backend y completa courtId y date', () => {
    const { result } = load();
    http.expectOne((request) => request.url === URL).flush(body);

    const value = result();
    if (value?.status !== 'ok') throw new Error('se esperaba ok');
    const slots = value.grid.courts[0].slots;
    expect(slots.map((slot) => slot.state)).toEqual(['available', 'reserved', 'blocked', 'class']);
    expect(slots.map((slot) => slot.isPast)).toEqual([true, false, false, false]);
    expect(slots.every((slot) => slot.courtId === 'court-1' && slot.date === '2026-10-23')).toBe(true);
    expect(value.grid.complex.name).toBe('Club');
    expect(value.grid.courts[0]).not.toHaveProperty('occupiedIntervals');
  });

  it.each([404, 400])('traduce %i a club no encontrado', (status) => {
    const { result } = load();
    http.expectOne((request) => request.url === URL).flush({ error: 'x' }, { status, statusText: 'x' });
    expect(result()).toEqual({ status: 'not-found' });
  });

  it.each([0, 500])('traduce el estado %i a error', (status) => {
    const { result } = load();
    const req = http.expectOne((request) => request.url === URL);
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush('boom', { status, statusText: 'Server Error' });
    expect(result()).toEqual({ status: 'error' });
  });

  function bodyWithPending(pendingMatch?: unknown) {
    const slot = {
      id: 'court-1:2026-10-23:15:00',
      startsAt: '15:00',
      endsAt: '16:30',
      status: 'PENDING_MATCH',
      isPast: false,
      ...(pendingMatch === undefined ? {} : { pendingMatch }),
    };
    return { ...body, courts: [{ ...body.courts[0], slots: [...body.courts[0].slots, slot] }] };
  }

  it('mapea PENDING_MATCH a pending con faltantes y nivel', () => {
    const { result } = load();
    http
      .expectOne((request) => request.url === URL)
      .flush(bodyWithPending({ missingPlayers: 2, level: '5ta' }));

    const value = result();
    if (value?.status !== 'ok') throw new Error('se esperaba ok');
    const pending = value.grid.courts[0].slots[4];
    expect(pending.state).toBe('pending');
    expect(pending.pendingMatch).toEqual({ missingPlayers: 2, level: '5ta' });
    expect(value.grid.courts[0].slots[0].pendingMatch).toBeUndefined();
  });

  it.each([
    ['sin pendingMatch', undefined],
    ['con faltantes en cero', { missingPlayers: 0, level: '5ta' }],
    ['con faltantes mayores a tres', { missingPlayers: 4, level: '5ta' }],
    ['con faltantes decimales', { missingPlayers: 1.5, level: '5ta' }],
    ['con faltantes como texto', { missingPlayers: '2', level: '5ta' }],
    ['sin nivel', { missingPlayers: 2 }],
    ['con nivel numérico', { missingPlayers: 2, level: 5 }],
    ['con pendingMatch nulo', null],
  ])('trata un PENDING_MATCH %s como error de parseo', (_name, pendingMatch) => {
    const { result } = load();
    http.expectOne((request) => request.url === URL).flush(bodyWithPending(pendingMatch));
    expect(result()).toEqual({ status: 'error' });
  });
  it('trata una respuesta mal formada como error', () => {
    const { result } = load();
    http.expectOne((request) => request.url === URL).flush({ complex: {} });
    expect(result()).toEqual({ status: 'error' });
  });
});
