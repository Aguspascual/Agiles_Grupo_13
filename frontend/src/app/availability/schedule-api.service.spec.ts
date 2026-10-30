import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ScheduleApiService } from './schedule-api.service';
import { WeeklyScheduleRule } from './availability.model';

const URL = '/api/v1/complexes/c1/courts/k1/weekly-schedule/days';
const day = (weekday: number, over: Record<string, unknown> = {}) => ({
  weekday, enabled: true, durationMinutes: 60, revision: 'rev-1',
  intervals: [{ id: 'i1', opensAt: '09:00', closesAt: '13:00' }], ...over,
});

describe('HU-04: ScheduleApiService', () => {
  let api: ScheduleApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ScheduleApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('load completa los 7 días; los ausentes quedan sin configurar y sin revision', () => {
    let result: WeeklyScheduleRule[] = [];
    api.load('c1', 'k1').subscribe((rules) => (result = rules));
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush({ days: [day(3)] });

    expect(result.map((rule) => rule.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result[2]).toEqual({
      weekday: 3, enabled: true, durationMinutes: 60, revision: 'rev-1',
      intervals: [{ id: 'i1', opensAt: '09:00', closesAt: '13:00' }],
    });
    expect(result[0]).toEqual({ weekday: 1, enabled: false, intervals: [], durationMinutes: 60 });
    expect(result[0].revision).toBeUndefined();
  });

  it('POST sin revision envía weekday, enabled, durationMinutes e intervals sin ids', () => {
    let saved: WeeklyScheduleRule | undefined;
    api.saveDay('c1', 'k1', {
      weekday: 2, enabled: true, durationMinutes: 90,
      intervals: [{ id: 'local-1', opensAt: '10:00', closesAt: '14:00' }],
    }).subscribe((rule) => (saved = rule));
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      weekday: 2, enabled: true, durationMinutes: 90, intervals: [{ opensAt: '10:00', closesAt: '14:00' }],
    });
    req.flush({ day: day(2, { durationMinutes: 90, revision: 'rev-new' }) }, { status: 201, statusText: 'Created' });

    expect(saved?.revision).toBe('rev-new');
  });

  it('PUT envía If-Match con la revisión, cuerpo sin weekday/revision/id y devuelve la nueva revisión', () => {
    let saved: WeeklyScheduleRule | undefined;
    api.saveDay('c1', 'k1', {
      weekday: 4, enabled: false, durationMinutes: 60, intervals: [], revision: 'rev-old',
    }).subscribe((rule) => (saved = rule));
    const req = http.expectOne(`${URL}/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('"rev-old"');
    expect(req.request.body).toEqual({ enabled: false, durationMinutes: 60, intervals: [] });
    req.flush({ day: day(4, { enabled: false, intervals: [], revision: 'rev-next' }) });

    expect(saved?.revision).toBe('rev-next');
  });

  it('rechaza una respuesta con forma inválida', () => {
    let failed = false;
    api.load('c1', 'k1').subscribe({ error: () => (failed = true) });
    http.expectOne(URL).flush({ days: [{ weekday: 9 }] });
    expect(failed).toBe(true);
  });
});
