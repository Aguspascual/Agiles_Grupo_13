import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AvailabilityPreviewStore } from '../availability/availability-preview.store';
import { ComplexSlotsPage } from './complex-slots.page';
import { CLOCK } from './slot-grid.service';

// Miércoles 21/10/2026, 20:18.
const NOW = new Date(2026, 9, 21, 20, 18);

describe('HU-05: página de turnos del complejo', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => localStorage.clear());

  async function render(
    complexId = 'complex-gonnet',
    fecha?: string,
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
    const fixture = TestBed.createComponent(ComplexSlotsPage);
    fixture.detectChanges();
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

  it('usa los horarios guardados en HU-04 y respeta sus bloqueos', async () => {
    // Lo que guarda la pantalla de HU-04 queda en localStorage y la grilla lo lee al cargar.
    const availability = new AvailabilityPreviewStore();
    availability.saveRules('court-gonnet-1', [
      {
        weekday: 4,
        enabled: true,
        durationMinutes: 60,
        intervals: [{ id: 'tarde', opensAt: '17:00', closesAt: '20:00' }],
      },
    ]);
    availability.toggleBlocked('court-gonnet-1:2026-10-22:18:00');

    const { fixture } = await render('complex-gonnet', '2026-10-22');
    const court = fixture.componentInstance
      .grid()!
      .courts.find((item) => item.id === 'court-gonnet-1')!;

    expect(court.slots.map((slot) => slot.startsAt)).toEqual(['17:00', '18:00', '19:00']);
    expect(court.slots[1].state).toBe('blocked');
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

  it('cierra la confirmación al cancelar la selección y no la vuelve a abrir', async () => {
    const { fixture, root } = await render();
    const page = fixture.componentInstance;
    const slots = page.grid()!.courts.flatMap((court) => court.slots);
    const [first, second] = slots.filter((slot) => slot.state === 'available');

    page.selectSlot(first);
    page.replaceDialogOpen.set(true);
    fixture.detectChanges();
    expect(root.querySelector('[role="alertdialog"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(page.replaceDialogOpen()).toBe(false);

    page.selectSlot(second);
    fixture.detectChanges();
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    fixture.destroy();
  });

  it('cierra el aviso de reemplazo al cambiar el día', async () => {
    const { fixture } = await render();
    const page = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.replacementNotice.set('Turno reservado para el grupo.');

    page.changeDate('2026-10-22');

    expect(page.replacementNotice()).toBe('');
    expect(page.replaceDialogOpen()).toBe(false);
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
    const { fixture, root } = await render('club-inexistente');

    expect(root.textContent).toContain('No encontramos este club');
    expect(root.querySelector('a[href="/clubes"]')).not.toBeNull();
    fixture.destroy();
  });
});
