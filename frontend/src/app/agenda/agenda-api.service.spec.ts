import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Agenda, AgendaApiService, ManualReservationInput } from './agenda-api.service';

const COMPLEX = 'c1';
const BASE = `/api/v1/complexes/${COMPLEX}`;

const reservation = {
  id: 'r1',
  origin: 'web',
  startsAt: '18:00',
  endsAt: '19:30',
  originalStartsAt: '2026-11-02T18:00:00-03:00',
  originalEndsAt: '2026-11-02T19:30:00-03:00',
  contact: { name: 'Ana Pérez', phone: '221 555 0101' },
  cancellable: true,
};

const agendaBody = {
  complex: { id: COMPLEX, name: 'Club Norte', address: 'Calle 1', zone: 'Gonnet' },
  date: '2026-11-02',
  courts: [
    {
      id: 'k1',
      name: 'Cancha 1',
      covered: true,
      slots: [
        { id: 'k1:2026-11-02:18:00', startsAt: '18:00', endsAt: '19:30', status: 'RESERVED', isPast: false, reservationId: 'r1' },
        { id: 'k1:2026-11-02:19:30', startsAt: '19:30', endsAt: '21:00', status: 'AVAILABLE', isPast: false },
      ],
      reservations: [reservation],
    },
  ],
};

describe('HU-07: AgendaApiService', () => {
  let api: AgendaApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(AgendaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta la agenda con la fecha como único parámetro y parsea nombre y teléfono', () => {
    let result: Agenda | undefined;
    api.load(COMPLEX, '2026-11-02').subscribe((agenda) => (result = agenda));
    const req = http.expectOne((request) => request.url === `${BASE}/agenda`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['date']);
    expect(req.request.params.get('date')).toBe('2026-11-02');
    req.flush(agendaBody);

    const court = result!.courts[0];
    expect(court.reservations[0].contact).toEqual({ name: 'Ana Pérez', phone: '221 555 0101' });
    expect(court.slots[0]).toMatchObject({ status: 'RESERVED', reservationId: 'r1' });
  });

  it('acepta reservas de partido abierto con teléfono vacío y rechaza orígenes desconocidos', () => {
    let result: Agenda | undefined;
    api.load(COMPLEX, '2026-11-02').subscribe((agenda) => (result = agenda));
    const open = structuredClone(agendaBody);
    open.courts[0].reservations = [{ ...reservation, origin: 'open_match', contact: { name: 'Ana', phone: '' } }];
    http.expectOne((request) => request.url === `${BASE}/agenda`).flush(open);
    expect(result!.courts[0].reservations[0]).toMatchObject({ origin: 'open_match', contact: { name: 'Ana', phone: '' } });

    let failed = false;
    api.load(COMPLEX, '2026-11-02').subscribe({ error: () => (failed = true) });
    const unknown = structuredClone(agendaBody);
    unknown.courts[0].reservations = [{ ...reservation, origin: 'bot' }];
    http.expectOne((request) => request.url === `${BASE}/agenda`).flush(unknown);
    expect(failed).toBe(true);
  });

  it('rechaza respuestas con estructura inválida', () => {
    let failed = false;
    api.load(COMPLEX, '2026-11-02').subscribe({ error: () => (failed = true) });
    http.expectOne((request) => request.url === `${BASE}/agenda`).flush({ complex: {}, courts: [] });
    expect(failed).toBe(true);

    failed = false;
    api.load(COMPLEX, '2026-11-02').subscribe({ error: () => (failed = true) });
    const broken = structuredClone(agendaBody);
    (broken.courts[0].slots[0] as { status: string }).status = 'PENDING_MATCH';
    http.expectOne((request) => request.url === `${BASE}/agenda`).flush(broken);
    expect(failed).toBe(true);
  });

  it('registra una reserva manual enviando exactamente date, startsAt y contact', () => {
    const input = {
      date: '2026-11-02',
      startsAt: '19:30',
      contact: { name: 'Luis', phone: '221 555 0102' },
      organizerId: 'intruso',
    } as ManualReservationInput;
    let id = '';
    api.registerManual(COMPLEX, 'k1', input).subscribe((receipt) => (id = receipt.id));
    const req = http.expectOne(`${BASE}/courts/k1/manual-reservations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      date: '2026-11-02',
      startsAt: '19:30',
      contact: { name: 'Luis', phone: '221 555 0102' },
    });
    req.flush({ reservation: { id: 'nueva', status: 'reserved' } }, { status: 201, statusText: 'Created' });
    expect(id).toBe('nueva');
  });

  it('cancela por el complejo sin body ni parámetros', () => {
    let status = '';
    api.cancel(COMPLEX, 'r1').subscribe((receipt) => (status = receipt.status));
    const req = http.expectOne(`${BASE}/reservations/r1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ reservation: { id: 'r1', status: 'cancelled' } });
    expect(status).toBe('cancelled');
  });

  it('propaga los errores HTTP para que la pantalla los traduzca', () => {
    let code = 0;
    api.cancel(COMPLEX, 'r1').subscribe({ error: (error) => (code = error.status) });
    http.expectOne(`${BASE}/reservations/r1/cancel`).flush({ error: 'la reserva ya finalizó' }, { status: 409, statusText: 'Conflict' });
    expect(code).toBe(409);
  });
});
