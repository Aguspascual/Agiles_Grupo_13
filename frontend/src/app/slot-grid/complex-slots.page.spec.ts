import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ComplexSlotsPage } from './complex-slots.page';
import { AuthSessionService } from '../auth/auth-session.service';
import { AuthTokenStore } from '../auth/auth-token.store';
import { CLOCK } from './slot-grid.service';

// Miércoles 21/10/2026, 20:18.
const NOW = new Date(2026, 9, 21, 20, 18);

const SLOTS_URL = (id: string) => `/api/v1/complexes/${id}/slots`;

function slotsBody(date: string) {
  const isToday = date === '2026-10-21';
  const court = (id: string, name: string, covered: boolean, pastToday: boolean) => {
    const slot = (startsAt: string, endsAt: string, status: string, isPast = false) => ({
      id: `${id}:${date}:${startsAt}`,
      startsAt,
      endsAt,
      status,
      isPast,
      ...(status === 'PENDING_MATCH' ? { pendingMatch: { missingPlayers: 2, level: '5ta' } } : {}),
    });
    return {
      id,
      name,
      covered,
      slots: [
        slot('18:00', '19:30', 'AVAILABLE', pastToday && isToday),
        slot('19:30', '21:00', 'AVAILABLE', pastToday && isToday),
        slot('21:00', '22:30', id === 'c2' ? 'PENDING_MATCH' : 'AVAILABLE'),
        slot('22:30', '24:00', 'RESERVED'),
      ],
      occupiedIntervals: [],
    };
  };
  return {
    complex: { id: 'complex-gonnet', name: 'Club Universitario Gonnet', address: 'Calle 14', zone: 'Gonnet' },
    date,
    courts: [court('c1', 'Cancha 1', true, true), court('c2', 'Cancha 2', false, true)],
  };
}

describe('HU-05: página de turnos del complejo', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  let http: HttpTestingController;

  async function render(
    complexId = 'complex-gonnet',
    fecha?: string,
    respond = true,
  ): Promise<{
    fixture: ComponentFixture<ComplexSlotsPage>;
    root: HTMLElement;
  }> {
    params = new BehaviorSubject(convertToParamMap({ complexId }));
    query = new BehaviorSubject(convertToParamMap(fecha ? { fecha } : {}));
    await TestBed.configureTestingModule({
      imports: [ComplexSlotsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CLOCK, useValue: () => NOW },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params,
            queryParamMap: query,
            snapshot: { paramMap: params.value, queryParamMap: query.value },
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ComplexSlotsPage);
    fixture.detectChanges();
    if (respond) {
      const req = http.expectOne((request) => request.url === SLOTS_URL(complexId));
      req.flush(slotsBody(req.request.params.get('date') ?? ''));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('muestra el club, sus canchas y la grilla del día sin necesidad de sesión', async () => {
    const { fixture, root } = await render();

    expect(root.querySelector('h1')?.textContent).toContain('Club Universitario Gonnet');
    expect(root.textContent).toContain('2 canchas · 1 techada');
    expect(root.querySelector('#slots-date')?.textContent).toContain('Miércoles, 21 de octubre');
    expect(root.querySelectorAll('.slot-grid__court')).toHaveLength(2);
    expect(root.querySelector('app-slot-legend')?.textContent).toContain('Libre');
    fixture.destroy();
  });

  it('no deja reservar los turnos de hoy que ya empezaron', async () => {
    const { fixture, root } = await render();
    const page = fixture.componentInstance;
    const today = page.grid()!.courts.flatMap((court) => court.slots);

    expect(today.filter((slot) => slot.startsAt <= '20:18').every((slot) => slot.isPast)).toBe(
      true,
    );
    expect(today.filter((slot) => slot.startsAt > '20:18').every((slot) => !slot.isPast)).toBe(
      true,
    );
    const pastLabels = [...root.querySelectorAll('.slot-cell.is-past')].map((cell) => cell.tagName);
    expect(pastLabels.length).toBeGreaterThan(0);
    expect(pastLabels.every((tag) => tag === 'DIV')).toBe(true);
    fixture.destroy();
  });

  it('acota la fecha de la URL entre hoy y los próximos 14 días', async () => {
    const past = await render('complex-gonnet', '2026-10-01');
    expect(past.fixture.componentInstance.dateKey()).toBe('2026-10-21');
    past.fixture.destroy();
    TestBed.resetTestingModule();

    const far = await render('complex-gonnet', '2027-01-15');
    expect(far.fixture.componentInstance.dateKey()).toBe('2026-11-03');
    far.fixture.destroy();
  });

  it('cambia de día desde la tira de fechas y descarta la selección', async () => {
    const { fixture, root } = await render();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;

    root.querySelector<HTMLButtonElement>('button.slot-cell')?.click();
    fixture.detectChanges();
    expect(root.querySelector('app-slot-summary')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('button[aria-label="Día siguiente"]')?.click();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { fecha: '2026-10-22' } }),
    );
    query.next(convertToParamMap({ fecha: '2026-10-22' }));
    fixture.detectChanges();

    expect(page.dateKey()).toBe('2026-10-22');
    expect(page.selectedSlotId()).toBeNull();
    expect(root.querySelector('app-slot-summary')).toBeNull();
    fixture.destroy();
  });

  it('permite elegir un turno de partido abierto y muestra faltantes y nivel', async () => {
    const { fixture, root } = await render('complex-gonnet', '2026-10-22');
    const cell = root.querySelector<HTMLButtonElement>('button.slot-cell.is-pending');

    expect(cell?.textContent).toContain('Partido abierto');
    cell?.click();
    fixture.detectChanges();
    const summary = root.querySelector('app-slot-summary');

    expect(summary?.textContent).toContain('Partido abierto');
    expect(summary?.textContent).toContain('Faltan 2 jugadores · nivel 5ta');
    expect(summary?.querySelector('a[href="/ingresar"]')?.textContent).toContain(
      'Ingresá para sumarte',
    );
    fixture.destroy();
  });

  it('ya no ofrece reservar como grupo completo ni cancelar el partido pendiente', async () => {
    const { fixture, root } = await render('complex-gonnet', '2026-10-22');
    const page = fixture.componentInstance as unknown as Record<string, unknown>;

    root.querySelector<HTMLButtonElement>('button.slot-cell.is-pending')?.click();
    fixture.detectChanges();

    expect(root.textContent).not.toContain('Reservar como grupo completo');
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    expect(page['canReplacePending']).toBeUndefined();
    expect(page['replacementNotice']).toBeUndefined();
    fixture.destroy();
  });

  it('con sesión, lleva a los partidos abiertos o a crear uno según el turno', async () => {
    const { fixture, root } = await render('complex-gonnet', '2026-10-22');
    TestBed.inject(AuthTokenStore).current.set('token');
    TestBed.inject(AuthSessionService).currentUser.set({
      id: 'u1',
      name: 'Ana Pérez',
      email: 'ana@example.com',
      zone: 'Gonnet',
      level: '5ta',
    });

    root.querySelector<HTMLButtonElement>('button.slot-cell.is-pending')?.click();
    fixture.detectChanges();
    const open = root.querySelector('app-slot-summary a.slot-summary__cta');
    expect(open?.textContent).toContain('Ver partidos abiertos');
    expect(open?.getAttribute('href')).toBe('/partidos');

    root.querySelector<HTMLButtonElement>('button.slot-cell.is-available')?.click();
    fixture.detectChanges();
    const create = root.querySelector('app-slot-summary a.slot-summary__cta');
    expect(create?.textContent).toContain('Reservar este turno');
    expect(create?.getAttribute('href')).toBe('/partidos?crear=1');
    fixture.destroy();
  });

  it('muestra un error si el backend envía un partido abierto sin datos válidos', async () => {
    const { fixture, root } = await render('complex-gonnet', undefined, false);
    const req = http.expectOne((request) => request.url === SLOTS_URL('complex-gonnet'));
    const body = slotsBody('2026-10-21');
    delete (body.courts[1].slots[2] as { pendingMatch?: unknown }).pendingMatch;
    req.flush(body);
    fixture.detectChanges();

    expect(root.querySelector('.slots-message[role="alert"]')).not.toBeNull();
    fixture.destroy();
  });

  it('resume el turno elegido e invita a ingresar para reservar', async () => {
    const { fixture, root } = await render('complex-gonnet', '2026-10-22');

    root.querySelector<HTMLButtonElement>('button.slot-cell.is-available')?.click();
    fixture.detectChanges();
    const summary = root.querySelector('app-slot-summary');

    expect(summary?.textContent).toContain('Jueves, 22 de octubre');
    expect(summary?.querySelector('a[href="/ingresar"]')?.textContent).toContain(
      'Ingresá para reservar',
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(root.querySelector('app-slot-summary')).toBeNull();
    fixture.destroy();
  });
  it('informa cuando el club no existe', async () => {
    const { fixture, root } = await render('club-inexistente', undefined, false);
    http.expectOne((req) => req.url === SLOTS_URL('club-inexistente'))
      .flush({ error: 'no encontrado' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(root.textContent).toContain('No encontramos este club');
    expect(root.querySelector('a[href="/clubes"]')).not.toBeNull();
    fixture.destroy();
  });

  it('muestra el error de conexión y vuelve a consultar al reintentar', async () => {
    const { fixture, root } = await render('complex-gonnet', undefined, false);
    http.expectOne((req) => req.url === SLOTS_URL('complex-gonnet')).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(root.textContent).toContain('No pudimos cargar los turnos. Revisá tu conexión e intentá nuevamente.');
    root.querySelector<HTMLButtonElement>('.slots-message button')?.click();
    fixture.detectChanges();
    const retried = http.expectOne((req) => req.url === SLOTS_URL('complex-gonnet'));
    retried.flush(slotsBody('2026-10-21'));
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Club Universitario Gonnet');
    fixture.destroy();
  });
});
