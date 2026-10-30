import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { debounceTime, Subscription } from 'rxjs';
import { ScheduleInterval, WeeklyScheduleRule, Weekday } from './availability.model';
import { isValidWeeklySchedule } from './availability-generator';

type IntervalForm = FormGroup<{
  id: FormControl<string>;
  opensAt: FormControl<string>;
  closesAt: FormControl<string>;
}>;
type DayForm = FormGroup<{
  weekday: FormControl<Weekday>;
  enabled: FormControl<boolean>;
  intervals: FormArray<IntervalForm>;
  durationMinutes: FormControl<60 | 90>;
}>;

const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' }, { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' },
  { id: 7, label: 'Domingo' },
];

@Component({
  selector: 'app-weekly-schedule-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './weekly-schedule-form.component.html',
  styleUrl: './weekly-schedule-form.component.scss',
})
export class WeeklyScheduleFormComponent implements OnDestroy {
  readonly weekdays = WEEKDAYS;
  readonly form = new FormGroup({ days: new FormArray<DayForm>([]) });
  @Output() readonly rulesChange = new EventEmitter<WeeklyScheduleRule[]>();
  @Output() readonly saveError = new EventEmitter<string>();
  private readonly changes: Subscription;
  private inputSnapshot = '';
  private intervalSequence = 0;
  private readonly openDays = new Set<Weekday>();

  @Input() set rules(rules: WeeklyScheduleRule[] | null) {
    const incoming = normalize(rules ?? createDefaultRules());
    const snapshot = JSON.stringify(incoming);
    const current = JSON.stringify(normalize(this.form.controls.days.getRawValue() as WeeklyScheduleRule[]));
    if (this.inputSnapshot === snapshot || current === snapshot) {
      this.inputSnapshot = snapshot;
      return;
    }
    this.inputSnapshot = snapshot;
    this.form.setControl('days', new FormArray(incoming.map(createDayForm)), { emitEvent: false });
    this.openDays.clear();
    const firstEnabled = incoming.find((rule) => rule.enabled);
    if (firstEnabled) this.openDays.add(firstEnabled.weekday);
  }

  /** Permite abrir el editor semanal desde el inicio (por ejemplo, dentro de un modal). */
  @Input() editorOpen = false;
  /** Oculta la tarjeta desplegable cuando el editor ya vive dentro de un modal. */
  @Input() showHeader = true;
  validationMessage = '';

  get enabledDayCount(): number {
    return this.form.controls.days.controls.filter((day) => day.controls.enabled.value).length;
  }

  constructor() {
    this.changes = this.form.valueChanges.pipe(debounceTime(350)).subscribe(() => this.publishValidRules());
  }

  addInterval(dayIndex: number): void {
    const day = this.form.controls.days.at(dayIndex);
    if (!day) return;
    const number = day.controls.intervals.length + 1;
    const interval: ScheduleInterval = number === 1
      ? { id: this.nextIntervalId(day.controls.weekday.value), opensAt: '09:00', closesAt: '13:00' }
      : { id: this.nextIntervalId(day.controls.weekday.value), opensAt: '17:00', closesAt: '22:00' };
    day.controls.intervals.push(createIntervalForm(interval));
    day.controls.intervals.updateValueAndValidity();
    day.updateValueAndValidity();
    this.form.updateValueAndValidity();
  }

  isDayOpen(weekday: Weekday): boolean {
    return this.openDays.has(weekday);
  }

  toggleDayDetails(weekday: Weekday): void {
    if (this.openDays.has(weekday)) this.openDays.delete(weekday);
    else this.openDays.add(weekday);
  }

  onDayToggle(dayIndex: number): void {
    const day = this.form.controls.days.at(dayIndex);
    if (day.controls.enabled.value) this.openDays.add(day.controls.weekday.value);
  }

  removeInterval(dayIndex: number, intervalIndex: number): void {
    const day = this.form.controls.days.at(dayIndex);
    if (!day || (day.controls.enabled.value && day.controls.intervals.length <= 1)) return;
    day.controls.intervals.removeAt(intervalIndex);
  }

  trackInterval(_index: number, interval: IntervalForm): string {
    return interval.controls.id.value;
  }

  ngOnDestroy(): void {
    this.changes.unsubscribe();
  }

  private publishValidRules(): void {
    const rules = (this.form.controls.days.getRawValue() as WeeklyScheduleRule[]).map((rule) =>
      rule.enabled ? rule : { ...rule, intervals: [] },
    );
    if (!isValidWeeklySchedule(rules)) {
      this.validationMessage = 'Revisá los horarios: las franjas no pueden superponerse y deben admitir un turno completo.';
      this.saveError.emit(this.validationMessage);
      return;
    }
    this.validationMessage = '';
    this.rulesChange.emit(rules);
  }

  private nextIntervalId(weekday: Weekday): string {
    this.intervalSequence += 1;
    return `interval-${weekday}-${this.intervalSequence}`;
  }
}

function createDayForm(rule: WeeklyScheduleRule): DayForm {
  const day = new FormGroup(
    {
      weekday: new FormControl(rule.weekday, { nonNullable: true }),
      enabled: new FormControl(rule.enabled, { nonNullable: true }),
      intervals: new FormArray((rule.intervals ?? []).map(createIntervalForm)),
      durationMinutes: new FormControl(rule.durationMinutes, { nonNullable: true }),
    },
    { validators: validateDay },
  );
  day.controls.enabled.valueChanges.subscribe((enabled) => {
    if (enabled && day.controls.intervals.length === 0) {
      day.controls.intervals.push(createIntervalForm({
        id: `interval-${rule.weekday}-default`,
        opensAt: '09:00',
        closesAt: '22:00',
      }));
    }
  });
  return day;
}

function createIntervalForm(interval: ScheduleInterval): IntervalForm {
  return new FormGroup({
    id: new FormControl(interval.id, { nonNullable: true }),
    opensAt: new FormControl(interval.opensAt, { nonNullable: true }),
    closesAt: new FormControl(interval.closesAt, { nonNullable: true }),
  });
}

function validateDay(control: AbstractControl): ValidationErrors | null {
  if (!control.get('enabled')?.value) return null;
  const intervals = control.get('intervals')?.getRawValue() as ScheduleInterval[] | undefined;
  const duration = control.get('durationMinutes')?.value;
  if (!intervals?.length) return { missingInterval: true };
  if (duration !== 60 && duration !== 90) return { invalidDuration: true };

  const ranges: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const start = parseTime(interval.opensAt);
    const end = parseTime(interval.closesAt);
    if (start === null || end === null) return { invalidTime: true };
    if (end <= start) return { closingBeforeOpening: true };
    if (end - start < duration) return { slotDoesNotFit: true };
    ranges.push({ start, end });
  }
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start < ranges[index - 1].end) return { overlappingIntervals: true };
  }
  return null;
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function normalize(rules: WeeklyScheduleRule[]): WeeklyScheduleRule[] {
  return [...rules]
    .sort((left, right) => left.weekday - right.weekday)
    .map((rule) => ({ ...rule, intervals: (rule.intervals ?? []).map((interval) => ({ ...interval })) }));
}

function createDefaultRules(): WeeklyScheduleRule[] {
  return WEEKDAYS.map(({ id }) => ({
    weekday: id,
    enabled: false,
    intervals: [],
    durationMinutes: 60,
  }));
}
