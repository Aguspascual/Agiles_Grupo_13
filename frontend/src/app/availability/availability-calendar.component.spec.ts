import { TestBed } from '@angular/core/testing';
import { AvailabilityCalendarComponent } from './availability-calendar.component';
import { AvailabilitySlot } from './availability.model';

function slot(overrides: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return {
    id: 'court-1:2026-10-12:09:00',
    courtId: 'court-1',
    date: '2026-10-12',
    startsAt: '09:00',
    endsAt: '10:00',
    status: 'available',
    ...overrides,
  };
}

describe('HU-04: agenda de disponibilidad', () => {
  async function render(slots: AvailabilitySlot[]) {
    await TestBed.configureTestingModule({ imports: [AvailabilityCalendarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvailabilityCalendarComponent);
    fixture.componentRef.setInput('slots', slots);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each received date and omits a turn counter', async () => {
    const fixture = await render([
      slot(),
      slot({ id: 'court-1:2026-10-12:10:00', startsAt: '10:00', endsAt: '11:00' }),
      slot({ id: 'court-1:2026-10-13:09:00', date: '2026-10-13' }),
    ]);

    expect(fixture.nativeElement.querySelectorAll('.day-group')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.day-heading h3').textContent).toContain(
      ' de octubre',
    );
    expect(fixture.nativeElement.textContent).toContain('09:00');
    expect(fixture.nativeElement.textContent).toContain('10:00');
    expect(fixture.nativeElement.textContent).not.toMatch(/\d+ turnos?/);
    fixture.destroy();
  });

  it('shows blocked status and emits the slot id to release it', async () => {
    const fixture = await render([slot({ status: 'blocked' })]);
    const toggle = vi.fn();
    fixture.componentInstance.toggleBlocked.subscribe(toggle);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(fixture.nativeElement.textContent).toContain('Bloqueado');
    expect(button.getAttribute('aria-label')).toContain('Liberar turno');
    button.click();

    expect(toggle).toHaveBeenCalledWith('court-1:2026-10-12:09:00');
    fixture.destroy();
  });

  it('shows an explicit empty state when no turns are generated', async () => {
    const fixture = await render([]);

    expect(fixture.nativeElement.textContent).toContain('No hay turnos para mostrar');
    expect(fixture.nativeElement.querySelectorAll('.day-group')).toHaveLength(0);
    fixture.destroy();
  });
});
