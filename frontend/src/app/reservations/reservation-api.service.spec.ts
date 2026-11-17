import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MyReservationsPage, ReservationApiService } from './reservation-api.service';

const reservationItem = {
  kind: 'reservation',
  id: 'r-1',
  reservationId: 'r-1',
  status: 'reserved',
  complex: { id: 'c-1', name: 'Club Norte' },
  court: { id: 'k-1', name: 'Cancha 1' },
  startsAt: '2026-11-03T18:00:00-03:00',
  endsAt: '2026-11-03T19:30:00-03:00',
  timeZone: 'America/Argentina/Buenos_Aires',
  role: 'organizer',
  cancellable: true,
};
const matchItem = {
  ...reservationItem,
  kind: 'match',
  id: 'm-1',
  reservationId: 'r-2',
  role: 'player',
  cancellable: false,
  match: { status: 'open', targetLevel: '5ta', missingPlayers: 2 },
};
const page = (items: unknown[], hasMore = false) => ({ items, page: { limit: 20, offset: 0, hasMore } });

describe('HU-17: ReservationApiService.listMine', () => {
  let api: ReservationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ReservationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta view, limit y offset exactos sin otros parámetros', () => {
    api.listMine('past', 20, 40).subscribe();
    const req = http.expectOne((request) => request.url === '/api/v1/me/reservations');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['limit', 'offset', 'view']);
    expect(req.request.params.get('view')).toBe('past');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('offset')).toBe('40');
    req.flush(page([]));
  });

  it('parsea reservas y partidos con su página', () => {
    let result: MyReservationsPage | undefined;
    api.listMine('upcoming', 20, 0).subscribe((value) => (result = value));
    http.expectOne((request) => request.url === '/api/v1/me/reservations').flush(page([reservationItem, matchItem], true));
    expect(result!.page).toEqual({ limit: 20, offset: 0, hasMore: true });
    expect(result!.items[0]).toMatchObject({ kind: 'reservation', cancellable: true, role: 'organizer' });
    expect(result!.items[0].match).toBeUndefined();
    expect(result!.items[1]).toMatchObject({
      kind: 'match',
      reservationId: 'r-2',
      role: 'player',
      match: { status: 'open', targetLevel: '5ta', missingPlayers: 2 },
    });
  });

  it('rechaza respuestas con kind, status, role o match inválidos', () => {
    const broken: unknown[] = [
      {},
      { ...page([]), items: 'x' },
      page([{ ...reservationItem, kind: 'other' }]),
      page([{ ...reservationItem, status: 'pending' }]),
      page([{ ...reservationItem, role: 'admin' }]),
      page([{ ...reservationItem, cancellable: 'yes' }]),
      page([{ ...reservationItem, match: { status: 'open', targetLevel: '5ta', missingPlayers: 1 } }]),
      page([{ ...matchItem, match: undefined }]),
      page([{ ...matchItem, match: { status: 'closed', targetLevel: '5ta', missingPlayers: 1 } }]),
      { items: [], page: { limit: 20, offset: 0 } },
    ];
    for (const body of broken) {
      let failed = false;
      api.listMine('upcoming', 20, 0).subscribe({ error: () => (failed = true) });
      http.expectOne((request) => request.url === '/api/v1/me/reservations').flush(body as object);
      expect(failed).toBe(true);
    }
  });
});

describe('HU-14: ReservationApiService', () => {
  let api: ReservationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ReservationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cancela la reserva propia sin body ni parámetros', () => {
    let status = '';
    api.cancelOwn('r-1').subscribe((receipt) => (status = receipt.status));
    const req = http.expectOne('/api/v1/reservations/r-1/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ reservation: { id: 'r-1', status: 'cancelled' } });
    expect(status).toBe('cancelled');
  });

  it('propaga 409 cuando faltan menos de 4 horas', () => {
    let code = 0;
    api.cancelOwn('r-1').subscribe({ error: (error) => (code = error.status) });
    http.expectOne('/api/v1/reservations/r-1/cancel').flush({ error: 'fuera del plazo de cancelación' }, { status: 409, statusText: 'Conflict' });
    expect(code).toBe(409);
  });

  it('rechaza una respuesta sin reserva', () => {
    let failed = false;
    api.cancelOwn('r-1').subscribe({ error: () => (failed = true) });
    http.expectOne('/api/v1/reservations/r-1/cancel').flush({});
    expect(failed).toBe(true);
  });
});

describe('HU-19: ReservationApiService de ausencias', () => {
  let api: ReservationApiService;
  let http: HttpTestingController;
  const state = {
    matchId: 'm-1', endsAt: '2026-11-03T19:30:00-03:00', deadline: '2026-11-05T19:30:00-03:00',
    serverNow: '2026-11-04T10:00:00-03:00', windowOpen: true,
    players: [
      { id: 'u-1', name: 'Ana', isSelf: true, reportCount: 0, confirmed: false, reportedByMe: false, canReport: false },
      { id: 'u-2', name: 'Beto', isSelf: false, reportCount: 1, confirmed: false, reportedByMe: true, canReport: false },
    ],
  };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ReservationApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('consulta el estado del partido mediante GET y parsea los jugadores sin identidades de reportantes', () => {
    let result: unknown;
    api.getAbsences('m/1').subscribe(value => result = value);
    const req = http.expectOne('/api/v1/matches/m%2F1/absence-reports');
    expect(req.request.method).toBe('GET');
    req.flush(state);
    expect(result).toEqual(state);
    expect(JSON.stringify(result)).not.toContain('reporter');
  });

  it('registra un reporte con POST y devuelve el estado actualizado', () => {
    let result: unknown;
    const updated = { ...state, players: state.players.map(player => player.id === 'u-2' ? { ...player, reportCount: 2, confirmed: true } : player) };
    api.reportAbsence('m-1', 'u-2').subscribe(value => result = value);
    const req = http.expectOne('/api/v1/matches/m-1/absence-reports');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ playerId: 'u-2' });
    req.flush(updated, { status: 201, statusText: 'Created' });
    expect(result).toEqual(updated);
  });

  it('propaga errores HTTP y rechaza respuestas de estado inválidas', () => {
    let status = -1;
    api.getAbsences('m-1').subscribe({ error: error => status = error.status });
    http.expectOne('/api/v1/matches/m-1/absence-reports').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    let rejected = false;
    api.getAbsences('m-1').subscribe({ error: () => rejected = true });
    http.expectOne('/api/v1/matches/m-1/absence-reports').flush({ ...state, players: [{ id: 'u-2' }] });
    expect(rejected).toBe(true);
  });
});
