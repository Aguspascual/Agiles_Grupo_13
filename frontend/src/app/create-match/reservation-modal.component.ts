import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { BookingPreviewStore } from '../bookings/booking-preview.store';
import { ReservationGroup } from '../bookings/booking.model';
import { CLOCK } from '../slot-grid/slot-grid.service';
import { GroupDetailsStepComponent } from './group-details-step.component';
import { MatchPreferences, MatchPreferencesComponent } from './match-preferences.component';
import { ReservationCostSummaryComponent } from './reservation-cost-summary.component';
import { ReservationSelection } from './create-match.model';
import { SlotSelectionStepComponent } from './slot-selection-step.component';
import { CreateMatchModalStore } from './create-match-modal.store';
import { ToastComponent } from '../shared/toast.component';

@Component({
  selector: 'app-reservation-modal',
  imports: [
    SlotSelectionStepComponent,
    GroupDetailsStepComponent,
    MatchPreferencesComponent,
    ReservationCostSummaryComponent,
    ToastComponent,
  ],
  templateUrl: './reservation-modal.component.html',
  styleUrl: './reservation-modal.component.scss',
})
export class ReservationModalComponent implements OnDestroy {
  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLDialogElement>;
  @ViewChild('confirmRegistrationButton') private confirmationActionRef?: ElementRef<HTMLButtonElement>;

  readonly modal = inject(CreateMatchModalStore);
  private readonly bookings = inject(BookingPreviewStore);
  private readonly clock = inject(CLOCK);
  readonly selection = signal<ReservationSelection | null>(null);
  readonly group = signal<ReservationGroup | null>(null);
  readonly mode = signal<'complete' | 'open'>('complete');
  readonly preferences = signal<MatchPreferences>({
    category: '5ta', gender: 'Masculino',
  });
  readonly status = signal<'editing' | 'confirming'>('editing');
  readonly message = signal('');
  readonly isClosing = signal(false);
  readonly toastMessage = signal('');
  readonly canConfirm = computed(() => this.status() === 'editing');
  readonly confirmationQuestion = computed(() => {
    const selection = this.selection();
    if (!selection) return '';
    const date = selection.slot.date;
    const [year, month, day] = date.split('-').map(Number);
    const label = new Date(year, month - 1, day).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return `¿Deseás registrar el turno para el día ${label} a las ${selection.slot.startsAt} hs?`;
  });
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingToast = '';

  constructor() {
    afterRenderEffect(() => {
      const open = this.modal.isOpen();
      const dialog = this.dialogRef?.nativeElement;
      if (open && dialog && !dialog.open) {
        this.reset();
        dialog.showModal();
      } else if (!open && dialog?.open) {
        dialog.close();
      }
      if (this.status() === 'confirming') this.confirmationActionRef?.nativeElement.focus();
      if (typeof document !== 'undefined') document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  setMode(mode: 'complete' | 'open'): void {
    this.mode.set(mode);
    this.message.set('');
  }

  onSelectionChange(selection: ReservationSelection | null): void {
    this.selection.set(selection);
    this.message.set('');
  }

  onGroupChange(group: ReservationGroup | null): void {
    this.group.set(group);
  }

  onPreferencesChange(preferences: MatchPreferences): void {
    this.preferences.set(preferences);
  }

  confirm(): void {
    const selection = this.selection();
    const group = this.group();
    if (!selection) {
      this.message.set('Elegí un horario disponible para continuar.');
      this.scrollTo('.booking-availability');
      return;
    }
    if (this.mode() === 'complete' && !group) {
      this.message.set('Completá los nombres de los otros tres jugadores.');
      this.scrollTo('.roster-section');
      return;
    }

    const [year, month, day] = selection.slot.date.split('-').map(Number);
    const [hours, minutes] = selection.slot.startsAt.split(':').map(Number);
    if (new Date(year, month - 1, day, hours, minutes) <= this.clock()) {
      this.message.set('Ese horario ya comenzó. Elegí otro para continuar.');
      this.selection.set(null);
      return;
    }

    this.status.set('confirming');
  }

  cancelConfirmation(): void {
    this.status.set('editing');
  }

  register(): void {
    const selection = this.selection();
    const group = this.group();
    if (!selection || this.status() !== 'confirming') return;

    const result = this.mode() === 'open'
      ? this.bookings.reserveOpen(selection.slot, 'Lucas M.', this.preferences().category)
      : this.bookings.reserve(selection.slot, {
        ...group!,
        preferences: this.preferences(),
      });
    if (result.status === 'conflict') {
      this.message.set('Ese horario acaba de ocuparse. Elegí otro para continuar.');
      this.selection.set(null);
      this.status.set('editing');
      return;
    }
    this.pendingToast = '¡Partido registrado! La reserva quedó confirmada.';
    this.close();
  }

  close(): void {
    const dialog = this.dialogRef?.nativeElement;
    if (!dialog?.open) {
      this.modal.close();
      if (this.pendingToast) this.showToast(this.pendingToast);
      return;
    }
    if (this.isClosing()) return;
    this.isClosing.set(true);
    this.closeTimer = setTimeout(() => {
      this.isClosing.set(false);
      dialog.close();
    }, this.motionDuration);
  }

  onDialogClosed(): void {
    this.modal.close();
    this.isClosing.set(false);
    if (this.pendingToast) {
      this.showToast(this.pendingToast);
      this.pendingToast = '';
    }
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set('');
  }

  ngOnDestroy(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  private reset(): void {
    this.selection.set(null);
    this.group.set(null);
    this.mode.set('complete');
    this.preferences.set({ category: '5ta', gender: 'Masculino' });
    this.status.set('editing');
    this.message.set('');
    this.isClosing.set(false);
    this.pendingToast = '';
  }

  private get motionDuration(): number {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000;
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }

  private scrollTo(selector: string): void {
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector(selector)?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }
}
