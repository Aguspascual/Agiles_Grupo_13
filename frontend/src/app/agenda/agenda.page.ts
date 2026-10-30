import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { ComplexOverviewComponent } from '../complexes/complex-overview.component';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';
import { addDays, capitalize, daysBetween, fromDateKey, startOfLocalDay, toDateKey } from '../shared/local-date';
import { ToastComponent } from '../shared/toast.component';
import { DayStripComponent } from '../slot-grid/day-strip.component';
import { SlotGridComponent } from '../slot-grid/slot-grid.component';
import { GridCourt, GridSlot, SlotState } from '../slot-grid/slot-grid.model';
import { CLOCK } from '../slot-grid/slot-grid.service';
import { Agenda, AgendaApiService, AgendaCourt, AgendaReservation, AgendaSlotStatus, ReservationOrigin } from './agenda-api.service';
import { ManualContact, ManualReservationDialogComponent } from './manual-reservation-dialog.component';
import { cancelOpenMatchNotice, missingLabel, playerNames, signedUpLabel } from './pending-match-labels';

/** Misma ventana que la API: hoy y los 13 días siguientes. */
export const AGENDA_WINDOW_DAYS = 14;

const CONNECTION_ERROR = 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
const PERMISSION_ERROR = 'No tenés permisos sobre este complejo.';
const GENERIC_ERROR = 'No se pudo completar la acción. Intentá nuevamente.';

const SLOT_STATES: Record<AgendaSlotStatus, SlotState> = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  BLOCKED: 'blocked',
};

type PageState =
  | { status: 'loading' }
  | { status: 'ok'; agenda: Agenda }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'error' };

interface Selection {
  slot: GridSlot;
  court: AgendaCourt;
  reservation: AgendaReservation | null;
}

interface OffGridReservation {
  court: AgendaCourt;
  reservation: AgendaReservation;
}

/** HU-07: agenda del complejo, con alta manual (HU-15) y cancelación (HU-14) para el encargado. */
@Component({
  selector: 'app-agenda-page',
  imports: [
    RouterLink,
    ComplexAdminSidebarComponent,
    ComplexOverviewComponent,
    DayStripComponent,
    SlotGridComponent,
    ManualReservationDialogComponent,
    ConfirmDialogComponent,
    ToastComponent,
  ],
  templateUrl: './agenda.page.html',
  styleUrl: './agenda.page.scss',
  host: { '(document:keydown.escape)': 'clearSelection()' },
})
export class AgendaPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AgendaApiService);
  private readonly title = inject(Title);
  private readonly clock = inject(CLOCK);

  private readonly loadedAt = this.clock();
  readonly windowDays = AGENDA_WINDOW_DAYS;
  readonly todayKey = toDateKey(startOfLocalDay(this.loadedAt));

  readonly complexId = toSignal(this.route.paramMap.pipe(map((params) => params.get('complexId') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('complexId') ?? '',
  });
  readonly dateKey = toSignal(this.route.queryParamMap.pipe(map((params) => this.clampDate(params.get('fecha')))), {
    initialValue: this.clampDate(this.route.snapshot.queryParamMap.get('fecha')),
  });

  /** En la vista completa del complejo se muestran sus datos y acciones sobre la agenda. */
  readonly overview = this.route.snapshot.data?.['overview'] === true;

  readonly state = signal<PageState>({ status: 'loading' });
  readonly selectedSlotId = signal<string | null>(null);
  readonly manualTarget = signal<Selection | null>(null);
  readonly manualClosing = signal(false);
  readonly cancelTarget = signal<{ reservation: AgendaReservation; court: AgendaCourt } | null>(null);
  readonly saving = signal(false);
  readonly toastMessage = signal('');

  private loadSubscription?: Subscription;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;

  readonly agenda = computed(() => {
    const state = this.state();
    return state.status === 'ok' ? state.agenda : null;
  });

  readonly dateLabel = computed(() => {
    const date = fromDateKey(this.dateKey());
    return date
      ? capitalize(date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))
      : '';
  });

  readonly nowMinute = computed(() =>
    this.dateKey() === this.todayKey ? this.loadedAt.getHours() * 60 + this.loadedAt.getMinutes() : null,
  );

  private readonly reservationsById = computed(() => {
    const byId = new Map<string, AgendaReservation>();
    for (const court of this.agenda()?.courts ?? []) {
      for (const reservation of court.reservations) byId.set(reservation.id, reservation);
    }
    return byId;
  });

  readonly gridCourts = computed<GridCourt[]>(() => {
    const agenda = this.agenda();
    if (!agenda) return [];
    return agenda.courts.map((court) => ({
      id: court.id,
      name: court.name,
      covered: court.covered,
      slots: court.slots.map((slot) => ({
        id: slot.id,
        courtId: court.id,
        date: agenda.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        state: SLOT_STATES[slot.status],
        isPast: slot.isPast,
      })),
    }));
  });

  /** Reserva de cada turno reservado, por id de turno. */
  private readonly reservationBySlot = computed(() => {
    const bySlot = new Map<string, AgendaReservation>();
    for (const court of this.agenda()?.courts ?? []) {
      for (const slot of court.slots) {
        const reservation = slot.reservationId ? this.reservationsById().get(slot.reservationId) : undefined;
        if (reservation) bySlot.set(slot.id, reservation);
      }
    }
    return bySlot;
  });

  /** Se pueden elegir los turnos libres futuros y los reservados que todavía se pueden cancelar. */
  readonly selectable = (slot: GridSlot): boolean => {
    if (slot.state === 'available') return !slot.isPast;
    if (slot.state === 'reserved') return this.reservationBySlot().get(slot.id)?.cancellable === true;
    return false;
  };

  reservationFor(slot: GridSlot): AgendaReservation | null {
    return this.reservationBySlot().get(slot.id) ?? null;
  }

  readonly selection = computed<Selection | null>(() => {
    const id = this.selectedSlotId();
    if (!id) return null;
    for (const court of this.gridCourts()) {
      const slot = court.slots.find((item) => item.id === id);
      const source = this.agenda()?.courts.find((item) => item.id === court.id);
      if (slot && source) return { slot, court: source, reservation: this.reservationBySlot().get(slot.id) ?? null };
    }
    return null;
  });

  /** Reservas vigentes del día que ningún turno de la grilla actual representa. */
  readonly offGrid = computed<OffGridReservation[]>(() =>
    (this.agenda()?.courts ?? []).flatMap((court) => {
      const shown = new Set(court.slots.map((slot) => slot.reservationId).filter(Boolean));
      return court.reservations
        .filter((reservation) => !shown.has(reservation.id))
        .map((reservation) => ({ court, reservation }));
    }),
  );

  readonly courtSummary = computed(() => {
    const courts = this.agenda()?.courts ?? [];
    return courts.length === 1 ? '1 cancha' : `${courts.length} canchas`;
  });

  constructor() {
    effect(() => {
      const complexId = this.complexId();
      const date = this.dateKey();
      untracked(() => {
        this.selectedSlotId.set(null);
        this.load(complexId, date, false);
      });
    });
    effect(() => {
      const name = this.agenda()?.complex.name;
      this.title.setTitle(name ? `Agenda de ${name} | PádelMatch` : 'Agenda | PádelMatch');
    });
  }

  notice(message: string): void {
    this.showToast(message);
  }

  retry(): void {
    this.load(this.complexId(), this.dateKey(), false);
  }

  selectSlot(slot: GridSlot): void {
    this.selectedSlotId.set(this.selectedSlotId() === slot.id ? null : slot.id);
  }

  clearSelection(): void {
    if (this.manualTarget() || this.cancelTarget()) return;
    this.selectedSlotId.set(null);
  }

  changeDate(key: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { fecha: key === this.todayKey ? null : key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openManual(selection: Selection): void {
    this.manualClosing.set(false);
    this.manualTarget.set(selection);
  }

  closeManual(): void {
    if (this.manualClosing() || !this.manualTarget() || this.saving()) return;
    this.manualClosing.set(true);
    const reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.closeTimer = setTimeout(() => this.finishManualClose(), reduced ? 0 : 260);
  }

  finishManualClose(): void {
    clearTimeout(this.closeTimer);
    this.manualTarget.set(null);
    this.manualClosing.set(false);
  }

  requestCancel(court: AgendaCourt, reservation: AgendaReservation): void {
    this.cancelTarget.set({ court, reservation });
  }

  cancelMessage(reservation: AgendaReservation): string {
    const base = `${reservation.contact.name} · ${reservation.startsAt} a ${reservation.endsAt}.`;
    if (reservation.origin === 'open_match') return `${base} ${cancelOpenMatchNotice(reservation.pendingMatch)}`;
    return reservation.origin === 'web' ? `${base} Se avisará al jugador.` : base;
  }

  originLabel(origin: ReservationOrigin): string {
    if (origin === 'web') return 'Web';
    return origin === 'open_match' ? 'Partido abierto' : 'Manual';
  }

  phoneLabel(phone: string): string {
    return phone.trim() || '—';
  }

  registerManual(contact: ManualContact): void {
    const target = this.manualTarget();
    if (!target || this.saving() || this.manualClosing()) return;
    this.saving.set(true);
    this.api
      .registerManual(this.complexId(), target.court.id, {
        date: this.dateKey(),
        startsAt: target.slot.startsAt,
        contact,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.finishManualClose();
          this.selectedSlotId.set(null);
          this.showToast('Reserva registrada.');
          this.load(this.complexId(), this.dateKey(), true);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const status = error instanceof HttpErrorResponse ? error.status : -1;
          if (status === 409 || status === 404) {
            this.finishManualClose();
            this.selectedSlotId.set(null);
            this.showToast(status === 409 ? 'Ese turno ya no está disponible.' : 'La cancha ya no existe.');
            this.load(this.complexId(), this.dateKey(), true);
            return;
          }
          this.showToast(
            status === 0
              ? CONNECTION_ERROR
              : status === 403
                ? 'No tenés permisos para esta acción.'
                : status === 400
                  ? 'Revisá los datos.'
                  : GENERIC_ERROR,
          );
        },
      });
  }

  confirmCancel(): void {
    const target = this.cancelTarget();
    if (!target || this.saving()) return;
    this.cancelTarget.set(null);
    this.saving.set(true);
    this.api.cancel(this.complexId(), target.reservation.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedSlotId.set(null);
        this.showToast(
          target.reservation.origin === 'web' ? 'Reserva cancelada. Se avisó al jugador.' : 'Reserva cancelada.',
        );
        this.load(this.complexId(), this.dateKey(), true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        if (status === 409 || status === 404) {
          this.selectedSlotId.set(null);
          this.showToast(status === 409 ? 'La reserva ya finalizó.' : 'La reserva ya no existe.');
          this.load(this.complexId(), this.dateKey(), true);
          return;
        }
        this.showToast(
          status === 0 ? CONNECTION_ERROR : status === 403 ? 'No tenés permisos para esta acción.' : GENERIC_ERROR,
        );
      },
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
    clearTimeout(this.closeTimer);
    this.loadSubscription?.unsubscribe();
  }

  /** `silent` conserva la agenda visible mientras se recarga tras una acción. */
  private load(complexId: string, date: string, silent: boolean): void {
    this.loadSubscription?.unsubscribe();
    if (!silent) this.state.set({ status: 'loading' });
    this.loadSubscription = this.api.load(complexId, date).subscribe({
      next: (agenda) => this.state.set({ status: 'ok', agenda }),
      error: (error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.state.set(
          status === 403 ? { status: 'forbidden' } : status === 404 ? { status: 'not-found' } : { status: 'error' },
        );
      },
    });
  }

  private showToast(message: string): void {
    clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }

  private clampDate(value: string | null): string {
    const today = startOfLocalDay(this.loadedAt);
    const date = fromDateKey(value);
    if (!date) return toDateKey(today);
    const offset = daysBetween(today, date);
    if (offset < 0) return toDateKey(today);
    return toDateKey(offset >= AGENDA_WINDOW_DAYS ? addDays(today, AGENDA_WINDOW_DAYS - 1) : date);
  }

  readonly missingLabel = missingLabel;
  readonly signedUpLabel = signedUpLabel;
  readonly playerNames = playerNames;
  readonly permissionError = PERMISSION_ERROR;
  readonly connectionError = CONNECTION_ERROR;
}
