import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';
import { LandingFooterComponent } from '../landing/landing-footer.component';
import { LandingHeaderComponent } from '../landing/landing-header.component';
import { ToastComponent } from '../shared/toast.component';
import { MyReservationCardComponent } from './my-reservation-card.component';
import { MyReservationsSummaryComponent } from './my-reservations-summary.component';
import { MyReservationItem, MyReservationView, ReservationApiService } from './reservation-api.service';

const PAGE_SIZE = 20;
const TOAST_MS = 3500;
const TABS: { view: MyReservationView; param: string; label: string }[] = [
  { view: 'upcoming', param: 'proximos', label: 'Próximos' },
  { view: 'past', param: 'jugados', label: 'Jugados' },
];

type ListStatus = 'loading' | 'ready' | 'error';

/** HU-17: consulta integrada de reservas propias y partidos desde la API autenticada. */
@Component({
  selector: 'app-my-reservations-page',
  imports: [RouterLink, LandingHeaderComponent, LandingFooterComponent, ConfirmDialogComponent, ToastComponent, MyReservationCardComponent, MyReservationsSummaryComponent],
  templateUrl: './my-reservations.page.html',
  styleUrl: './my-reservations.page.scss',
})
export class MyReservationsPage implements OnInit {
  private readonly api = inject(ReservationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private nextOffset = 0;

  readonly tabs = TABS;
  readonly view = signal<MyReservationView>('upcoming');
  readonly items = signal<MyReservationItem[]>([]);
  readonly status = signal<ListStatus>('loading');
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly saving = signal(false);
  readonly cancelTarget = signal<MyReservationItem | null>(null);
  readonly toastMessage = signal('');
  readonly nextItem = computed(() =>
    this.view() === 'upcoming' ? this.items().find((item) => item.status === 'reserved') ?? null : null,
  );
  readonly nextDate = computed(() => this.nextItem() ? this.dateLabel(this.nextItem()!) : '');
  readonly nextTime = computed(() => this.nextItem() ? this.timeLabel(this.nextItem()!) : '');
  readonly reservationCount = computed(() => this.items().filter((item) => item.kind === 'reservation').length);
  readonly matchCount = computed(() => this.items().filter((item) => item.kind === 'match').length);
  readonly cancelledCount = computed(() => this.items().filter((item) => item.status === 'cancelled').length);
  readonly emptyMessage = computed(() =>
    this.view() === 'upcoming' ? 'Todavía no tenés reservas próximas.' : 'Todavía no jugaste ningún partido.',
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.loadSubscription?.unsubscribe();
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
  }

  ngOnInit(): void {
    this.view.set(viewFromParam(this.route.snapshot.queryParamMap.get('vista')));
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const next = viewFromParam(params.get('vista'));
      if (next !== this.view()) {
        this.view.set(next);
        this.load();
      }
    });
    this.load();
  }

  selectView(view: MyReservationView): void {
    if (view === this.view()) return;
    this.view.set(view);
    this.load();
    const param = TABS.find((tab) => tab.view === view)?.param;
    void this.router.navigate([], { queryParams: { vista: param }, replaceUrl: true });
  }

  onTabKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const tab = TABS[(index + step + TABS.length) % TABS.length];
    this.selectView(tab.view);
    queueMicrotask(() => document.getElementById(`tab-${tab.param}`)?.focus());
  }

  load(): void {
    this.loadSubscription?.unsubscribe();
    this.status.set('loading');
    this.items.set([]);
    this.hasMore.set(false);
    this.loadingMore.set(false);
    this.nextOffset = 0;
    this.loadSubscription = this.api.listMine(this.view(), PAGE_SIZE, 0).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.nextOffset = result.page.offset + result.items.length;
        this.hasMore.set(result.page.hasMore);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.api.listMine(this.view(), PAGE_SIZE, this.nextOffset).subscribe({
      next: (result) => {
        const known = new Set(this.items().map(itemKey));
        this.items.update((current) => [...current, ...result.items.filter((item) => !known.has(itemKey(item)))]);
        this.nextOffset = result.page.offset + result.items.length;
        this.hasMore.set(result.page.hasMore);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
        this.showToast('No pudimos cargar más. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }

  requestCancel(item: MyReservationItem): void {
    if (this.saving() || !item.cancellable) return;
    this.cancelTarget.set(item);
  }

  confirmCancel(): void {
    const target = this.cancelTarget();
    if (!target || this.saving()) return;
    this.saving.set(true);
    this.api.cancelOwn(target.reservationId).subscribe({
      next: () => {
        this.finishCancel('Reserva cancelada.', true);
      },
      error: (error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        if (status === 409) this.finishCancel('Ya no se puede cancelar: faltan menos de 4 horas.', true);
        else if (status === 404) this.finishCancel('La reserva ya no existe.', true);
        else if (status === 0) this.finishCancel('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.', false);
        else this.finishCancel('No pudimos cancelar la reserva. Intentá nuevamente.', false);
      },
    });
  }

  dateLabel(item: MyReservationItem): string {
    const label = format(item, { weekday: 'long', day: 'numeric', month: 'long' }, item.startsAt);
    return label.charAt(0).toLocaleUpperCase('es-AR') + label.slice(1);
  }

  timeLabel(item: MyReservationItem): string {
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    return `${format(item, options, item.startsAt)} a ${format(item, options, item.endsAt)}`;
  }

  itemKey = itemKey;

  private finishCancel(message: string, reload: boolean): void {
    this.saving.set(false);
    this.cancelTarget.set(null);
    this.showToast(message);
    if (reload) this.load();
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), TOAST_MS);
  }
}

function itemKey(item: MyReservationItem): string {
  return `${item.kind}:${item.id}`;
}

function viewFromParam(param: string | null): MyReservationView {
  return TABS.find((tab) => tab.param === param)?.view ?? 'upcoming';
}

/** Las horas se muestran en la zona que informa el servidor, no en la del navegador. */
function format(item: MyReservationItem, options: Intl.DateTimeFormatOptions, iso: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat('es-AR', { ...options, timeZone: item.timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('es-AR', options).format(date);
  }
}
