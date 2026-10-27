import { Component, computed, ElementRef, inject, input, OnInit, output, signal, ViewChild } from '@angular/core';
import { BookingPreviewStore } from '../bookings/booking-preview.store';
import { ComplexPreviewStore } from '../complexes/complex-preview.store';
import { CourtPreviewStore } from '../courts/court-preview.store';
import { addDays, capitalize, fromDateKey, startOfLocalDay, toDateKey } from '../shared/local-date';
import { CLOCK, DayGridResult, SlotGridService } from '../slot-grid/slot-grid.service';
import { hasStarted } from '../slot-grid/slot-grid.builder';
import { GridSlot } from '../slot-grid/slot-grid.model';
import { ReservationSelection } from './create-match.model';

@Component({
  selector: 'app-slot-selection-step',
  templateUrl: './slot-selection-step.component.html',
  styleUrl: './slot-selection-step.component.scss',
})
export class SlotSelectionStepComponent implements OnInit {
  @ViewChild('complexMenu') private complexMenuRef?: ElementRef<HTMLDetailsElement>;
  private readonly complexesStore = inject(ComplexPreviewStore);
  private readonly courtsStore = inject(CourtPreviewStore);
  private readonly bookings = inject(BookingPreviewStore);
  private readonly gridService = inject(SlotGridService);
  private readonly clock = inject(CLOCK);
  private readonly loadedAt = this.clock();

  readonly complexes = this.complexesStore.complexes;
  readonly dateKey = signal(toDateKey(startOfLocalDay(this.loadedAt)));
  readonly complexId = signal('');
  readonly courtId = signal('');
  readonly selectedSlotId = signal<string | null>(null);
  readonly initialSelection = input<ReservationSelection | null>(null);
  readonly state = signal<DayGridResult | { status: 'loading' | 'error' }>({ status: 'not-found' });
  readonly selectionChange = output<ReservationSelection | null>();
  readonly courts = computed(() => this.courtsStore.forComplex(this.complexId()));
  readonly selectedComplex = computed(() =>
    this.complexes().find((complex) => complex.id === this.complexId()) ?? null,
  );
  readonly grid = computed(() => {
    const state = this.state();
    return state.status === 'ok' ? state.grid : null;
  });
  readonly sourceSlots = computed(() =>
    this.grid()?.courts.find((court) => court.id === this.courtId())?.slots ?? [],
  );
  readonly availableSlots = computed(() => hourlyChoices(this.sourceSlots(), this.clock())
    .filter((slot) => !slot.isPast && !this.bookings.bookingFor(slot)));
  readonly minDate = toDateKey(startOfLocalDay(this.loadedAt));
  readonly maxDate = toDateKey(addDays(this.loadedAt, 13));
  readonly tomorrowDate = toDateKey(addDays(this.loadedAt, 1));
  readonly dateLabel = computed(() => {
    const date = fromDateKey(this.dateKey());
    return date ? capitalize(date.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })) : '';
  });

  ngOnInit(): void {
    const previous = this.initialSelection();
    if (previous) {
      this.complexId.set(previous.complexId);
      this.courtId.set(previous.courtId);
      this.dateKey.set(previous.slot.date);
      this.loadGrid(previous.slot.id);
      return;
    }
    const initialComplex = this.complexes().find((item) => item.id === 'complex-cumbre')
      ?? this.complexes()[0];
    if (!initialComplex) return;
    this.complexId.set(initialComplex.id);
    this.courtId.set(this.courtsStore.forComplex(initialComplex.id)[0]?.id ?? '');
    this.loadGrid();
  }

  selectQuickDate(date: string): void {
    this.changeDate(date);
  }

  selectComplex(value: string): void {
    this.changeComplex(value);
    const menu = this.complexMenuRef?.nativeElement;
    menu?.removeAttribute('open');
    menu?.querySelector('summary')?.focus();
  }

  changeComplex(value: string): void {
    this.complexId.set(value);
    this.courtId.set('');
    this.selectedSlotId.set(null);
    this.selectionChange.emit(null);
    this.loadGrid();
  }

  changeCourt(value: string): void {
    this.courtId.set(value);
    this.selectedSlotId.set(null);
    this.selectionChange.emit(null);
  }

  changeDate(value: string): void {
    const date = fromDateKey(value);
    if (!date || value < this.minDate || value > this.maxDate) return;
    this.dateKey.set(value);
    this.selectedSlotId.set(null);
    this.selectionChange.emit(null);
    this.loadGrid();
  }

  chooseSlot(slot: GridSlot): void {
    this.selectedSlotId.set(slot.id);
    const grid = this.grid();
    const court = grid?.courts.find((item) => item.id === slot.courtId);
    if (!grid || !court) return;
    this.selectionChange.emit({
      complexId: grid.complex.id,
      complexName: grid.complex.name,
      courtId: court.id,
      courtName: court.name,
      slot,
    });
  }

  private loadGrid(restoreSlotId?: string): void {
    const id = this.complexId();
    if (!id) {
      this.state.set({ status: 'not-found' });
      return;
    }
    this.state.set({ status: 'loading' });
    const date = fromDateKey(this.dateKey());
    if (!date) return;
    this.gridService.dayGrid(id, date).subscribe({
      next: (result) => {
        this.state.set(result);
        if (result.status !== 'ok') return;
        const firstCourt = result.grid.courts.find((court) => court.id === this.courtId())
          ?? result.grid.courts[0];
        this.courtId.set(firstCourt?.id ?? '');
        if (restoreSlotId) {
          const restored = firstCourt?.slots.find((slot) => slot.id === restoreSlotId);
          if (restored?.state === 'available' && !restored.isPast && !this.bookings.bookingFor(restored)) {
            this.selectedSlotId.set(restoreSlotId);
          } else {
            this.selectedSlotId.set(null);
            this.selectionChange.emit(null);
          }
        }
      },
      error: () => this.state.set({ status: 'error' }),
    });
  }
}

/** Convierte los tramos demo disponibles en opciones consecutivas de una hora. */
function hourlyChoices(source: GridSlot[], now: Date): GridSlot[] {
  const openSlots = source
    .filter((slot) => slot.state === 'available' && !slot.isPast)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const windows: { start: number; end: number; slot: GridSlot }[] = [];

  for (const slot of openSlots) {
    const start = minutes(slot.startsAt);
    const end = minutes(slot.endsAt);
    const window = windows.at(-1);
    if (window && start <= window.end) window.end = Math.max(window.end, end);
    else windows.push({ start, end, slot });
  }

  return windows.flatMap(({ start, end, slot }) => {
    const options: GridSlot[] = [];
    for (let minute = Math.ceil(start / 60) * 60; minute + 60 <= end; minute += 60) {
      const startsAt = formatTime(minute);
      const endsAt = formatTime(minute + 60);
      options.push({
        id: `${slot.courtId}:${slot.date}:${startsAt}`,
        courtId: slot.courtId,
        date: slot.date,
        startsAt,
        endsAt,
        state: 'available',
        isPast: hasStarted(slot.date, startsAt, now),
      });
    }
    return options;
  });
}

function minutes(time: string): number {
  const [hours, minute] = time.split(':').map(Number);
  return hours * 60 + minute;
}

function formatTime(totalMinutes: number): string {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}
