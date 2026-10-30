import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReservationApiService } from './reservation-api.service';

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
