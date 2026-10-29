import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, startWith, switchMap } from 'rxjs';
import { LandingFooterComponent } from '../landing/landing-footer.component';
import { LandingHeaderComponent } from '../landing/landing-header.component';
import { isPendingReplacementWindowOpen } from '../bookings/booking.model';
import {
  addDays,
  capitalize,
  daysBetween,
  fromDateKey,
  startOfLocalDay,
  toDateKey,
} from '../shared/local-date';
import { DayStripComponent } from './day-strip.component';
import { SlotGridComponent } from './slot-grid.component';
import { GridSlot } from './slot-grid.model';
import { CLOCK, DayGridResult, SlotGridService } from './slot-grid.service';
import { SlotLegendComponent } from './slot-legend.component';
import { SlotSummaryComponent } from './slot-summary.component';

/** Días que el jugador puede consultar a partir de hoy. */
export const BOOKING_WINDOW_DAYS = 14;

type PageState = DayGridResult | { status: 'loading' };

/** HU-05: grilla pública de turnos de un complejo, por día. */
@Component({
  selector: 'app-complex-slots-page',
  imports: [
    RouterLink,
    LandingHeaderComponent,
    LandingFooterComponent,
    DayStripComponent,
    SlotGridComponent,
    SlotLegendComponent,
    SlotSummaryComponent,
  ],
  templateUrl: './complex-slots.page.html',
  styleUrl: './complex-slots.page.scss',
  host: { '(document:keydown.escape)': 'clearSelection()' },
})
export class ComplexSlotsPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(SlotGridService);
  private readonly title = inject(Title);
  private readonly clock = inject(CLOCK);

  private readonly loadedAt = this.clock();
  readonly windowDays = BOOKING_WINDOW_DAYS;
  readonly todayKey = toDateKey(startOfLocalDay(this.loadedAt));

  private readonly complexId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('complexId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('complexId') ?? '' },
  );

  readonly dateKey = toSignal(
    this.route.queryParamMap.pipe(map((params) => this.clampDate(params.get('fecha')))),
    { initialValue: this.clampDate(this.route.snapshot.queryParamMap.get('fecha')) },
  );

  readonly state = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      switchMap(([params, query]) => {
        const date =
          fromDateKey(this.clampDate(query.get('fecha'))) ?? startOfLocalDay(this.loadedAt);
        return this.service
          .dayGrid(params.get('complexId') ?? '', date)
          .pipe(startWith<PageState>({ status: 'loading' }));
      }),
    ),
    { initialValue: { status: 'loading' } as PageState },
  );

  readonly grid = computed(() => {
    const state = this.state();
    if (state.status !== 'ok') return null;
    const replaced = new Set(this.replacedSlotIds());
    return { ...state.grid, courts: state.grid.courts.map((court) => ({
      ...court,
      slots: court.slots.map((slot) => replaced.has(slot.id)
        ? { ...slot, state: 'reserved' as const, pendingMatch: undefined }
        : slot),
    })) };
  });

  readonly dateLabel = computed(() => {
    const date = fromDateKey(this.dateKey());
    return date
      ? capitalize(
          date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
        )
      : '';
  });

  readonly nowMinute = computed(() =>
    this.dateKey() === this.todayKey
      ? this.loadedAt.getHours() * 60 + this.loadedAt.getMinutes()
      : null,
  );

  readonly courtSummary = computed(() => {
    const courts = this.grid()?.courts ?? [];
    const covered = courts.filter((court) => court.covered).length;
    const total = courts.length === 1 ? '1 cancha' : `${courts.length} canchas`;
    return covered ? `${total} · ${covered} techada${covered === 1 ? '' : 's'}` : total;
  });

  readonly selectedSlotId = signal<string | null>(null);
  readonly replacedSlotIds = signal<string[]>([]);
  readonly replaceDialogOpen = signal(false);
  readonly replacementNotice = signal('');
  private replacementNoticeTimer?: ReturnType<typeof setTimeout>;
  readonly selection = computed(() => {
    const id = this.selectedSlotId();
    for (const court of this.grid()?.courts ?? []) {
      const slot = court.slots.find((item) => item.id === id);
      if (slot) return { slot, courtName: court.name };
    }
    return null;
  });

  readonly canReplacePending = computed(() => {
    const slot = this.selection()?.slot;
    if (!slot || slot.state !== 'pending' || slot.isPast) return false;
    const startsAt = new Date(`${this.dateKey()}T${slot.startsAt}:00`);
    return isPendingReplacementWindowOpen(startsAt, this.clock());
  });

  constructor() {
    effect(() => {
      const name = this.grid()?.complex.name;
      this.title.setTitle(name ? `Turnos de ${name} | PádelMatch` : 'Turnos | PádelMatch');
    });
    // Al cambiar de club o de día se descarta la selección anterior.
    effect(() => {
      this.complexId();
      this.dateKey();
      this.selectedSlotId.set(null);
      this.replaceDialogOpen.set(false);
      this.clearReplacementNotice();
    });
  }

  selectSlot(slot: GridSlot): void {
    this.replaceDialogOpen.set(false);
    this.clearReplacementNotice();
    this.selectedSlotId.set(this.selectedSlotId() === slot.id ? null : slot.id);
  }

  clearSelection(): void {
    this.selectedSlotId.set(null);
    this.replaceDialogOpen.set(false);
    this.clearReplacementNotice();
  }

  requestPendingReplacement(): void {
    if (this.canReplacePending()) this.replaceDialogOpen.set(true);
  }

  confirmPendingReplacement(): void {
    const slot = this.selection()?.slot;
    if (!slot || !this.canReplacePending()) return;
    this.replacedSlotIds.update((ids) => [...ids, slot.id]);
    this.replaceDialogOpen.set(false);
    this.replacementNotice.set('Turno reservado para el grupo. El partido pendiente fue cancelado.');
    clearTimeout(this.replacementNoticeTimer);
    this.replacementNoticeTimer = setTimeout(() => this.clearReplacementNotice(), 4000);
  }

  changeDate(key: string): void {
    this.selectedSlotId.set(null);
    this.replaceDialogOpen.set(false);
    this.clearReplacementNotice();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { fecha: key === this.todayKey ? null : key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.replacementNoticeTimer);
  }

  private clearReplacementNotice(): void {
    clearTimeout(this.replacementNoticeTimer);
    this.replacementNoticeTimer = undefined;
    this.replacementNotice.set('');
  }

  /** Acepta solo días entre hoy y el final de la ventana de reserva. */
  private clampDate(value: string | null): string {
    const today = startOfLocalDay(this.loadedAt);
    const date = fromDateKey(value);
    if (!date) return toDateKey(today);
    const offset = daysBetween(today, date);
    if (offset < 0) return toDateKey(today);
    return toDateKey(
      offset >= BOOKING_WINDOW_DAYS ? addDays(today, BOOKING_WINDOW_DAYS - 1) : date,
    );
  }
}
