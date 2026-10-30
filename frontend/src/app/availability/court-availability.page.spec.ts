import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CourtAvailabilityPage } from './court-availability.page';
import { WeeklyScheduleRule } from './availability.model';

const COURT_DAYS = (courtId: string) =>
  `/api/v1/complexes/complex-gonnet/courts/${courtId}/weekly-schedule/days`;
const DAYS = COURT_DAYS('court-gonnet-1');
const weekdayToday = (new Date().getDay() || 7) as WeeklyScheduleRule['weekday'];

function savedDay(weekday: number, over: Record<string, unknown> = {}) {
  return {
    weekday, enabled: true, durationMinutes: 60, revision: `rev-${weekday}`,
    intervals: [{ id: `i-${weekday}`, opensAt: '09:00', closesAt: '13:00' }], ...over,
  };
}

describe('HU-04: página de horarios por cancha', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function setup(
    params = { complexId: 'complex-gonnet', courtId: 'court-gonnet-1' },
  ): Promise<ComponentFixture<CourtAvailabilityPage>> {
    const paramMap = convertToParamMap(params);
    await TestBed.configureTestingModule({
      imports: [CourtAvailabilityPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap }, paramMap: of(paramMap) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CourtAvailabilityPage);
    fixture.detectChanges();
    return fixture;
  }

  async function render(
    params = { complexId: 'complex-gonnet', courtId: 'court-gonnet-1' },
    days: unknown[] = [],
  ): Promise<{ fixture: ComponentFixture<CourtAvailabilityPage>; root: HTMLElement }> {
    const fixture = await setup(params);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/complexes').flush({
      complexes: [{ id: 'complex-gonnet', name: 'Club Universitario Gonnet', address: 'Calle 14', zone: 'Gonnet', phone: '1', managerIds: [] }],
    });
    http.expectOne('/api/v1/complexes/complex-gonnet/courts').flush({
      courts: [
        { id: 'court-gonnet-1', complexId: 'complex-gonnet', name: 'Cancha 1', covered: true, imageDataUrl: null, features: [] },
        { id: 'court-gonnet-2', complexId: 'complex-gonnet', name: 'Cancha 2', covered: false, imageDataUrl: null, features: [] },
      ],
    });
    http.expectOne(COURT_DAYS(params.courtId)).flush({ days });
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('resolves the selected court without breadcrumbs or a demo badge', async () => {
    const { fixture, root } = await render();

    expect(root.textContent).toContain('Disponibilidad');
    expect(root.textContent).toContain('Cancha 1');
    expect(root.textContent).not.toContain('Demo local');
    expect(root.querySelector('.breadcrumbs')).toBeNull();
    fixture.destroy();
  });

  it('keeps the schedule controls compact and avoids repeated helper text', async () => {
    const { fixture, root } = await render();

    expect(root.querySelectorAll('h2')).toHaveLength(1);
    expect(root.textContent).toContain('Horario semanal');
    expect(root.textContent).not.toContain('Administrá días, turnos y duración');
    expect(root.textContent).not.toContain('Disponibilidad del día seleccionado');
    expect(root.querySelector('.day-group .day-heading')).toBeNull();
    fixture.destroy();
  });

  it('offers a designed keyboard-accessible court picker with the selected court marked', async () => {
    const { fixture, root } = await render();
    const picker = root.querySelector('details.court-picker');
    const trigger = picker?.querySelector('summary');

    expect(root.querySelector('select')).toBeNull();
    expect(trigger?.textContent).toContain('Cancha 1');
    expect(picker?.querySelectorAll('.court-picker-menu a')).toHaveLength(2);
    expect(picker?.querySelector('a[aria-current="page"]')?.textContent).toContain('Cancha 1');
    expect(picker?.querySelector('a[href="/admin/complejos/complex-gonnet/canchas/court-gonnet-2/horarios"]')?.textContent)
      .toContain('Cancha 2');
    trigger?.click();
    expect((picker as HTMLDetailsElement)?.open).toBe(true);
    fixture.destroy();
  });

  it('derives the preview of the selected date from the loaded schedule and navigates day by day', async () => {
    const { fixture, root } = await render(undefined, [
      savedDay(weekdayToday, { intervals: [{ id: 'all', opensAt: '09:00', closesAt: '22:00' }] }),
    ]);
    const page = fixture.componentInstance;

    expect(page.slots()).toHaveLength(13);
    expect(new Set(page.slots().map((slot) => slot.date)).size).toBe(1);
    for (let day = 0; day < 35; day += 1) page.nextDay();
    fixture.detectChanges();
    expect(page.slots()).toHaveLength(13);
    expect(page.selectedDate().getDate()).not.toBe(new Date().getDate());
    expect(root.querySelector('.availability-calendar button')).toBeNull();
    fixture.destroy();
  });

  it('does not navigate before today', async () => {
    const { fixture } = await render();
    const page = fixture.componentInstance;
    page.previousDay();
    expect(page.selectedDate().toDateString()).toBe(new Date().toDateString());
    fixture.destroy();
  });

  it('sends only the changed days, one at a time, and keeps each new revision', async () => {
    const { fixture } = await render(undefined, [savedDay(1), savedDay(2)]);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const edited = page.rules().map((rule) => {
      if (rule.weekday > 3) return rule;
      const intervals = rule.weekday === 3
        ? [{ id: 'n', opensAt: '10:00', closesAt: '14:00' }]
        : rule.intervals;
      return { ...rule, enabled: true, durationMinutes: 90 as const, intervals };
    });

    page.saveRules(edited);
    const first = http.expectOne(`${DAYS}/1`);
    expect(first.request.method).toBe('PUT');
    expect(first.request.headers.get('If-Match')).toBe('"rev-1"');
    http.expectNone(`${DAYS}/2`);
    first.flush({ day: savedDay(1, { durationMinutes: 90, revision: 'rev-1b' }) });
    http.expectOne(`${DAYS}/2`).flush({ day: savedDay(2, { durationMinutes: 90, revision: 'rev-2b' }) });
    const third = http.expectOne(DAYS);
    expect(third.request.method).toBe('POST');
    third.flush(
      { day: savedDay(3, { durationMinutes: 90, revision: 'rev-3' }) },
      { status: 201, statusText: 'Created' },
    );
    fixture.detectChanges();

    expect(page.rules().filter((rule) => rule.revision).map((rule) => rule.revision))
      .toEqual(['rev-1b', 'rev-2b', 'rev-3']);
    expect(fixture.nativeElement.textContent).toContain('Horarios actualizados.');
    fixture.destroy();
  });

  it('does not call the backend when the emitted schedule equals the stored one', async () => {
    const { fixture } = await render(undefined, [savedDay(1)]);
    fixture.componentInstance.saveRules(fixture.componentInstance.rules());
    fixture.destroy();
  });

  it('saves only the last pending change after the one in flight', async () => {
    const { fixture } = await render(undefined, [savedDay(1)]);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const withDuration = (durationMinutes: 60 | 90) =>
      page.rules().map((rule) => (rule.weekday === 1 ? { ...rule, durationMinutes } : rule));

    page.saveRules(withDuration(90));
    page.saveRules([...withDuration(60).map((rule) => (rule.weekday === 1 ? { ...rule, enabled: false, intervals: [] } : rule))]);
    page.saveRules(withDuration(90).map((rule) => (rule.weekday === 1 ? { ...rule, intervals: [{ id: 'x', opensAt: '08:00', closesAt: '12:00' }] } : rule)));
    http.expectOne(`${DAYS}/1`).flush({ day: savedDay(1, { durationMinutes: 90, revision: 'rev-1b' }) });
    const last = http.expectOne(`${DAYS}/1`);
    expect(last.request.headers.get('If-Match')).toBe('"rev-1b"');
    expect(last.request.body.intervals).toEqual([{ opensAt: '08:00', closesAt: '12:00' }]);
    last.flush({ day: savedDay(1, { revision: 'rev-1c' }) });
    fixture.destroy();
  });

  it('reloads and informs on a stale revision (412)', async () => {
    const { fixture } = await render(undefined, [savedDay(1)]);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    page.saveRules(page.rules().map((rule) => (rule.weekday === 1 ? { ...rule, durationMinutes: 90 as const } : rule)));
    http.expectOne(`${DAYS}/1`).flush({ error: 'el horario cambió' }, { status: 412, statusText: 'Precondition Failed' });
    http.expectOne(DAYS).flush({ days: [savedDay(1, { revision: 'rev-new' })] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El horario cambió; actualizamos los datos.');
    expect(page.rules()[0].revision).toBe('rev-new');
    expect(page.rules()[0].durationMinutes).toBe(60);
    fixture.destroy();
  });

  it('reloads and informs when future reservations block the change (409)', async () => {
    const { fixture } = await render(undefined, [savedDay(1)]);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    page.saveRules(page.rules().map((rule) => (rule.weekday === 1 ? { ...rule, enabled: false, intervals: [] } : rule)));
    http.expectOne(`${DAYS}/1`).flush(
      { error: 'el cambio afecta reservas futuras vigentes' }, { status: 409, statusText: 'Conflict' },
    );
    http.expectOne(DAYS).flush({ days: [savedDay(1)] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El cambio afecta reservas futuras vigentes.');
    expect(page.rules()[0].enabled).toBe(true);
    fixture.destroy();
  });

  it('keeps the form on a 400 and reloads the stored schedule', async () => {
    const { fixture, root } = await render(undefined, [savedDay(1)]);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    page.saveRules(page.rules().map((rule) => (rule.weekday === 1 ? { ...rule, durationMinutes: 90 as const } : rule)));
    http.expectOne(`${DAYS}/1`).flush({ error: 'datos inválidos' }, { status: 400, statusText: 'Bad Request' });
    http.expectOne(DAYS).flush({ days: [savedDay(1)] });
    fixture.detectChanges();

    expect(root.textContent).toContain('Revisá los horarios.');
    expect(root.querySelector('app-weekly-schedule-form')).not.toBeNull();
    fixture.destroy();
  });

  it('shows a permissions message when the schedule cannot be loaded (403)', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/complexes').flush({ complexes: [] });
    http.expectOne('/api/v1/complexes/complex-gonnet/courts').flush({ courts: [] });
    http.expectOne(DAYS).flush({ error: 'sin permisos' }, { status: 403, statusText: 'Forbidden' });

    expect(fixture.componentInstance.loadError()).toBe('No tenés permisos sobre este complejo.');
    fixture.destroy();
  });

  it('shows a safe empty state for an unknown court', async () => {
    const { fixture, root } = await render({ complexId: 'complex-gonnet', courtId: 'missing-court' });

    expect(root.textContent).toContain('No encontramos esta cancha');
    expect(root.querySelector('a[href="/admin/complejos/complex-gonnet/canchas"]')).not.toBeNull();
    fixture.destroy();
  });
});
