import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CourtAvailabilityPage } from './court-availability.page';
import { WeeklyScheduleRule } from './availability.model';

const STORAGE_KEY = 'padelmatch.availability.v2';

describe('HU-04: página de horarios por cancha', () => {
  beforeEach(() => localStorage.clear());

  async function render(
    params: { complexId: string; courtId: string } = {
      complexId: 'complex-gonnet', courtId: 'court-gonnet-1',
    },
  ): Promise<{ fixture: ComponentFixture<CourtAvailabilityPage>; root: HTMLElement }> {
    const paramMap = convertToParamMap(params);
    await TestBed.configureTestingModule({
      imports: [CourtAvailabilityPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap }, paramMap: of(paramMap) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CourtAvailabilityPage);
    fixture.detectChanges();
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

  it('shows only the selected date and navigates indefinitely one day at a time', async () => {
    const { fixture, root } = await render();
    const page = fixture.componentInstance;
    const weekday = ((new Date().getDay() || 7) as WeeklyScheduleRule['weekday']);
    const rules = page.rules().map((rule) => rule.weekday === weekday
      ? { ...rule, enabled: true, intervals: [{ id: 'all-day', opensAt: '09:00', closesAt: '22:00' }] }
      : rule);
    page.saveRules(rules);
    fixture.detectChanges();

    expect(page.slots()).toHaveLength(13);
    expect(new Set(page.slots().map((slot) => slot.date)).size).toBe(1);
    for (let day = 0; day < 35; day += 1) page.nextDay();
    fixture.detectChanges();
    expect(page.slots()).toHaveLength(13);
    expect(page.selectedDate().getDate()).not.toBe(new Date().getDate());
    expect(root.textContent).not.toContain('28 días');
    expect(root.textContent).not.toMatch(/\d+ turnos/);
    fixture.destroy();
  });

  it('does not navigate before today and persists blocking for the selected date', async () => {
    const { fixture, root } = await render();
    const page = fixture.componentInstance;
    page.previousDay();
    expect(page.selectedDate().toDateString()).toBe(new Date().toDateString());
    const weekday = ((new Date().getDay() || 7) as WeeklyScheduleRule['weekday']);
    page.saveRules(page.rules().map((rule) => rule.weekday === weekday
      ? { ...rule, enabled: true, intervals: [{ id: 'one', opensAt: '09:00', closesAt: '10:00' }] }
      : rule));
    fixture.detectChanges();

    const firstSlot = page.slots()[0];
    page.toggleSlot(firstSlot.id);
    expect(page.slots()[0].status).toBe('blocked');
    expect(root.textContent).toContain('Horarios actualizados.');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').blockedSlotIds).toContain(firstSlot.id);
    fixture.destroy();
  });

  it('shows a safe empty state for an unknown court', async () => {
    const { fixture, root } = await render({ complexId: 'complex-gonnet', courtId: 'missing-court' });

    expect(root.textContent).toContain('No encontramos esta cancha');
    expect(root.querySelector('a[href="/admin/complejos/complex-gonnet/canchas"]')).not.toBeNull();
    fixture.destroy();
  });
});
