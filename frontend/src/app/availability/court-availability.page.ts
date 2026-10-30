import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { concatMap, finalize, from, map } from 'rxjs';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { ComplexApiService } from '../complexes/complex-api.service';
import { ComplexRecord } from '../complexes/complex.model';
import { CourtApiService } from '../courts/court-api.service';
import { ToastComponent } from '../shared/toast.component';
import { AvailabilityCalendarComponent } from './availability-calendar.component';
import { generateAvailabilitySlots } from './availability-generator';
import { ScheduleApiService } from './schedule-api.service';
import { WeeklyScheduleFormComponent } from './weekly-schedule-form.component';
import { CourtPickerComponent } from './court-picker.component';
import { WeeklyScheduleRule } from './availability.model';
import { changedDays, loadMessage, saveMessage } from './schedule-utils';

interface RouteIds {
  complexId: string;
  courtId: string;
}

@Component({
  selector: 'app-court-availability-page',
  standalone: true,
  imports: [
    RouterLink,
    ComplexAdminSidebarComponent,
    WeeklyScheduleFormComponent,
    AvailabilityCalendarComponent,
    ToastComponent,
    CourtPickerComponent,
  ],
  templateUrl: './court-availability.page.html',
  styleUrl: './court-availability.page.scss',
})
export class CourtAvailabilityPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly complexApi = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);
  private readonly schedules = inject(ScheduleApiService);
  private pendingRules: WeeklyScheduleRule[] | null = null;
  private readonly routeIds = toSignal(
    this.route.paramMap.pipe(
      map((params) => ({
        complexId: params.get('complexId') ?? '',
        courtId: params.get('courtId') ?? '',
      })),
    ),
    {
      initialValue: {
        complexId: this.route.snapshot.paramMap.get('complexId') ?? '',
        courtId: this.route.snapshot.paramMap.get('courtId') ?? '',
      },
    },
  );
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  readonly currentComplexId = computed(() => this.routeIds().complexId);
  private readonly apiComplexes = signal<ComplexRecord[]>([]);
  readonly complex = computed(
    () => this.apiComplexes().find((item) => item.id === this.currentComplexId()) ?? null,
  );
  readonly courts = this.courtApi.courts;
  readonly court = computed(
    () => this.courts().find((item) => item.id === this.routeIds().courtId) ?? null,
  );
  /** Horarios tal como están en el backend (con `revision`); base del diff al guardar. */
  readonly rules = signal<WeeklyScheduleRule[]>([]);
  /** Horarios que recibe el formulario: solo cambian al cargar, para no pisar lo que se está editando. */
  readonly formRules = signal<WeeklyScheduleRule[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly selectedDate = signal(startOfLocalDay());
  readonly selectedDateLabel = computed(() => formatSelectedDate(this.selectedDate()));
  readonly previousDayDisabled = computed(() => isSameLocalDate(this.selectedDate(), startOfLocalDay()));
  readonly slots = computed(() => {
    const court = this.court();
    return court ? generateAvailabilitySlots(court.id, this.rules(), this.selectedDate(), new Set()) : [];
  });
  readonly toastMessage = signal('');

  ngOnInit(): void {
    const complexId = this.currentComplexId();
    this.complexApi.list().subscribe({ next: (complexes) => this.apiComplexes.set(complexes), error: () => undefined });
    this.courtApi.load(complexId).subscribe({ error: () => undefined });
    this.schedules.load(complexId, this.routeIds().courtId).subscribe({
      next: (rules) => this.applyLoaded(rules),
      error: (error: unknown) => {
        this.loadError.set(loadMessage(error));
        this.loading.set(false);
      },
    });
  }

  previousDay(): void {
    if (this.previousDayDisabled()) return;
    this.selectedDate.update((date) => shiftDate(date, -1));
  }

  nextDay(): void {
    this.selectedDate.update((date) => shiftDate(date, 1));
  }

  saveRules(incoming: WeeklyScheduleRule[]): void {
    if (this.saving()) {
      this.pendingRules = incoming;
      return;
    }
    const { complexId, courtId } = this.routeIds();
    const changed = changedDays(this.rules(), incoming);
    if (!changed.length) return;
    this.saving.set(true);
    from(changed)
      .pipe(
        concatMap((rule) => this.schedules.saveDay(complexId, courtId, rule)),
        finalize(() => this.finishSave()),
      )
      .subscribe({
        next: (saved) =>
          this.rules.update((rules) => rules.map((rule) => (rule.weekday === saved.weekday ? saved : rule))),
        complete: () => this.showToast('Horarios actualizados.'),
        error: (error: unknown) => {
          this.pendingRules = null;
          this.showToast(saveMessage(error));
          this.reload();
        },
      });
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private finishSave(): void {
    this.saving.set(false);
    const pending = this.pendingRules;
    this.pendingRules = null;
    if (pending) this.saveRules(pending);
  }

  private reload(): void {
    this.schedules.load(this.currentComplexId(), this.routeIds().courtId).subscribe({
      next: (rules) => this.applyLoaded(rules),
      error: () => undefined,
    });
  }

  private applyLoaded(rules: WeeklyScheduleRule[]): void {
    this.rules.set(rules);
    this.formRules.set(rules);
    this.loadError.set('');
    this.loading.set(false);
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }
}

function startOfLocalDay(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
}

function shiftDate(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function formatSelectedDate(date: Date): string {
  const value = date.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return value.charAt(0).toLocaleUpperCase('es-AR') + value.slice(1);
}
