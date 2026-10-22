import { TestBed } from '@angular/core/testing';
import { WeeklyScheduleFormComponent } from './weekly-schedule-form.component';
import { WeeklyScheduleRule } from './availability.model';

function schedule(): WeeklyScheduleRule[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday: weekday as WeeklyScheduleRule['weekday'],
    enabled: weekday === 1,
    intervals: weekday === 1
      ? [{ id: 'monday-am', opensAt: '09:00', closesAt: '12:00' }]
      : [],
    durationMinutes: 60,
  }));
}

describe('HU-04: editor semanal con autoguardado', () => {
  async function renderForm(rules = schedule()) {
    await TestBed.configureTestingModule({ imports: [WeeklyScheduleFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(WeeklyScheduleFormComponent);
    fixture.componentRef.setInput('rules', rules);
    fixture.detectChanges();
    return fixture;
  }

  it('starts collapsed and exposes the expanded state accessibly', async () => {
    const fixture = await renderForm();
    const toggle = fixture.nativeElement.querySelector('.editor-toggle') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.interval-row')).not.toBeNull();
    fixture.destroy();
  });

  it('adds and removes a second interval and preserves the first', async () => {
    const fixture = await renderForm();
    (fixture.nativeElement.querySelector('.editor-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.add-interval') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.days.at(0).controls.intervals.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.interval-row')).toHaveLength(2);
    (fixture.nativeElement.querySelectorAll('.remove-interval')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.days.at(0).controls.intervals.length).toBe(1);
    fixture.destroy();
  });

  it('does not emit invalid overlapping ranges and reports the error', async () => {
    const fixture = await renderForm();
    const emitted = vi.fn();
    fixture.componentInstance.rulesChange.subscribe(emitted);
    const monday = fixture.componentInstance.form.controls.days.at(0);
    fixture.componentInstance.addInterval(0);
    monday.controls.intervals.at(1).controls.opensAt.setValue('11:00');
    monday.controls.intervals.at(1).controls.closesAt.setValue('14:00');
    await vi.waitFor(() => expect(fixture.componentInstance.validationMessage).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 380));

    expect(emitted).not.toHaveBeenCalled();
    expect(fixture.componentInstance.validationMessage).toContain('superponerse');
    fixture.destroy();
  });

  it('debounces a valid edit once and emits the complete weekly rules', async () => {
    vi.useFakeTimers();
    const fixture = await renderForm();
    const emitted = vi.fn();
    fixture.componentInstance.rulesChange.subscribe(emitted);
    fixture.componentInstance.form.controls.days.at(0).controls.durationMinutes.setValue(90);

    await vi.advanceTimersByTimeAsync(349);
    expect(emitted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0]).toHaveLength(7);
    expect(emitted.mock.calls[0][0][0].durationMinutes).toBe(90);
    fixture.destroy();
    vi.useRealTimers();
  });

  it('creates a default interval when enabling a day without configured intervals', async () => {
    const fixture = await renderForm();
    const tuesday = fixture.componentInstance.form.controls.days.at(1);
    tuesday.controls.enabled.setValue(true);

    expect(tuesday.controls.intervals.length).toBe(1);
    expect(tuesday.controls.intervals.at(0).getRawValue()).toMatchObject({
      opensAt: '09:00', closesAt: '22:00',
    });
    fixture.destroy();
  });

  it('does not remove the last interval while a day stays enabled', async () => {
    const fixture = await renderForm();
    const monday = fixture.componentInstance.form.controls.days.at(0);
    fixture.componentInstance.removeInterval(0, 0);

    expect(monday.controls.intervals.length).toBe(1);
    fixture.destroy();
  });
});
