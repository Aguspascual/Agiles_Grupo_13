import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CourtApiService } from './court-api.service';
import { CourtDraft, CourtRecord } from './court.model';

const COMPLEX = 'c1';
const URL = `/api/v1/complexes/${COMPLEX}/courts`;
const court = (id: string, name = 'Cancha 1'): CourtRecord => ({
  id, complexId: COMPLEX, name, covered: true, imageDataUrl: null, features: ['lighting'],
});

describe('HU-03: CourtApiService', () => {
  let api: CourtApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(CourtApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las canchas del complejo y las expone en el signal', () => {
    api.load(COMPLEX).subscribe();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush({ courts: [court('a'), court('b', 'Cancha 2')] });

    expect(api.courts().map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('crea enviando exactamente name, covered, imageDataUrl y features', () => {
    const draft: CourtDraft = { name: 'Cancha 3', covered: false, imageDataUrl: null, features: ['wifi'] };
    api.create(COMPLEX, { ...draft, id: 'x', complexId: COMPLEX } as CourtDraft).subscribe();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(draft);
    req.flush({ court: court('n', 'Cancha 3') }, { status: 201, statusText: 'Created' });

    expect(api.courts().map((item) => item.id)).toEqual(['n']);
  });

  it('edita enviando los cuatro campos y reemplaza la cancha en el signal', () => {
    api.courts.set([court('a')]);
    const draft: CourtDraft = { name: 'Nueva', covered: true, imageDataUrl: null, features: [] };
    api.update(COMPLEX, 'a', draft).subscribe();
    const req = http.expectOne(`${URL}/a`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(draft);
    req.flush({ court: court('a', 'Nueva') });

    expect(api.courts()[0].name).toBe('Nueva');
  });

  it('da de baja y quita la cancha del signal', () => {
    api.courts.set([court('a'), court('b')]);
    api.remove(COMPLEX, 'a').subscribe();
    const req = http.expectOne(`${URL}/a`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(api.courts().map((item) => item.id)).toEqual(['b']);
  });

  it('propaga el 409 por reservas futuras sin tocar el signal', () => {
    api.courts.set([court('a')]);
    const onError = vi.fn();
    api.remove(COMPLEX, 'a').subscribe({ error: onError });
    http.expectOne(`${URL}/a`).flush({ error: 'future reservations exist' }, { status: 409, statusText: 'Conflict' });

    expect(onError.mock.calls[0][0].status).toBe(409);
    expect(api.courts()).toHaveLength(1);
  });
});
