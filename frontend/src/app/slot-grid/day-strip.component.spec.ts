import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayStripComponent } from './day-strip.component';

describe('HU-05: selector de día', () => {
  let fixture: ComponentFixture<DayStripComponent>;
  let root: HTMLElement;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DayStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(DayStripComponent);
    fixture.componentRef.setInput('today', '2026-10-21');
    fixture.componentRef.setInput('selected', '2026-10-21');
    emitted = [];
    fixture.componentInstance.dateChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  it('ofrece los próximos 14 días empezando por hoy y mañana', () => {
    const chips = [...root.querySelectorAll('.day-chip')];

    expect(chips).toHaveLength(14);
    expect(chips[0].textContent).toContain('Hoy');
    expect(chips[1].textContent).toContain('Mañana');
    expect(chips[0].getAttribute('aria-current')).toBe('date');
    expect(chips[2].getAttribute('aria-label')).toBe('Viernes, 23 de octubre');
  });

  it('no permite volver antes de hoy ni pasar el último día', () => {
    const back = root.querySelector<HTMLButtonElement>('button[aria-label="Día anterior"]')!;
    const next = root.querySelector<HTMLButtonElement>('button[aria-label="Día siguiente"]')!;
    expect(back.disabled).toBe(true);

    fixture.componentRef.setInput('selected', '2026-11-03');
    fixture.detectChanges();
    expect(back.disabled).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it('avisa el día elegido con las flechas o con los accesos directos', () => {
    root.querySelector<HTMLButtonElement>('button[aria-label="Día siguiente"]')?.click();
    root.querySelectorAll<HTMLButtonElement>('.day-chip')[4].click();
    root.querySelectorAll<HTMLButtonElement>('.day-chip')[0].click();

    expect(emitted).toEqual(['2026-10-22', '2026-10-25']);
  });
});
