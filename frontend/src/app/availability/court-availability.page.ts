import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { ComplexApiService } from '../complexes/complex-api.service';
import { ComplexPreviewStore } from '../complexes/complex-preview.store';
import { ComplexRecord, DemoRole } from '../complexes/complex.model';
import { CourtApiService } from '../courts/court-api.service';
import { ToastComponent } from '../shared/toast.component';
import { AvailabilityCalendarComponent } from './availability-calendar.component';
import { AvailabilityPreviewStore } from './availability-preview.store';
import { WeeklyScheduleFormComponent } from './weekly-schedule-form.component';
import { CourtPickerComponent } from './court-picker.component';
import { WeeklyScheduleRule } from './availability.model';

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
  private readonly complexStore = inject(ComplexPreviewStore);
  private readonly complexApi = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);
  private readonly availabilityStore = inject(AvailabilityPreviewStore);
  private readonly scheduleRevision = signal(0);
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
  readonly rules = computed(() => {
    this.scheduleRevision();
    const court = this.court();
    return court ? this.availabilityStore.rulesFor(court.id) : [];
  });
  readonly selectedDate = signal(startOfLocalDay());
  readonly selectedDateLabel = computed(() => formatSelectedDate(this.selectedDate()));
  readonly previousDayDisabled = computed(() => isSameLocalDate(this.selectedDate(), startOfLocalDay()));
  readonly slots = computed(() => {
    const court = this.court();
    return court ? this.availabilityStore.slotsFor(court.id, this.selectedDate()) : [];
  });
  readonly persistenceAvailable = this.availabilityStore.persistenceAvailable;
  readonly managers = this.complexStore.managers;
  readonly role = signal<DemoRole>('admin');
  readonly managerId = signal(this.managers[0].id);
  readonly toastMessage = signal('');

  ngOnInit(): void {
    const complexId = this.currentComplexId();
    this.complexApi.list().subscribe({ next: (complexes) => this.apiComplexes.set(complexes), error: () => undefined });
    this.courtApi.load(complexId).subscribe({ error: () => undefined });
  }

  previousDay(): void {
    if (this.previousDayDisabled()) return;
    this.selectedDate.update((date) => shiftDate(date, -1));
  }

  nextDay(): void {
    this.selectedDate.update((date) => shiftDate(date, 1));
  }

  saveRules(rules: WeeklyScheduleRule[]): void {
    const court = this.court();
    if (!court) return;
    try {
      this.availabilityStore.saveRules(court.id, rules);
      this.scheduleRevision.update((revision) => revision + 1);
      this.showToast(this.persistenceAvailable() ? 'Horarios actualizados.' : 'Horarios aplicados en esta sesión.');
    } catch {
      this.showToast('No pudimos guardar los horarios. Revisá la configuración.');
    }
  }

  toggleSlot(slotId: string): void {
    const slot = this.slots().find((item) => item.id === slotId);
    if (!slot) return;
    this.availabilityStore.toggleBlocked(slotId);
    this.showToast(slot.status === 'blocked' ? 'Turno disponible nuevamente.' : 'Turno bloqueado.');
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
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
