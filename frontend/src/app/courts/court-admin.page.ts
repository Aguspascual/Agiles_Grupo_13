import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ToastComponent } from '../shared/toast.component';
import { ComplexApiService } from '../complexes/complex-api.service';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { ComplexRecord } from '../complexes/complex.model';
import { CourtCardComponent } from './court-card.component';
import { CourtFormDialogComponent } from './court-form-dialog.component';
import { CourtDraft, CourtRecord } from './court.model';
import { CourtApiService } from './court-api.service';

const CONNECTION_ERROR = 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
const PERMISSION_ERROR = 'No tenés permisos sobre este complejo.';

@Component({
  selector: 'app-court-admin-page',
  standalone: true,
  imports: [
    RouterLink,
    CourtCardComponent,
    CourtFormDialogComponent,
    ConfirmDialogComponent,
    ToastComponent,
    ComplexAdminSidebarComponent,
  ],
  templateUrl: './court-admin.page.html',
  styleUrl: './court-admin.page.scss',
})
export class CourtAdminPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly complexApi = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);
  private readonly routeId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('complexId') ?? '')),
    {
      initialValue: this.route.snapshot.paramMap.get('complexId') ?? '',
    },
  );
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingToast = '';

  readonly complexes = signal<ComplexRecord[]>([]);
  readonly complex = computed(() => this.complexes().find((item) => item.id === this.routeId()) ?? null);
  readonly currentComplexId = this.routeId;
  readonly courts = this.courtApi.courts;
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly formClosing = signal(false);
  readonly editing = signal<CourtRecord | null>(null);
  readonly deleteTarget = signal<CourtRecord | null>(null);
  readonly toastMessage = signal('');

  constructor() {
    effect(() => {
      const complexId = this.routeId();
      untracked(() => this.load(complexId));
    });
  }

  load(complexId = this.routeId()): void {
    this.loading.set(true);
    this.loadError.set('');
    this.courtApi.courts.set([]);
    this.complexApi.list().subscribe({
      next: (complexes) => {
        if (complexId !== this.routeId()) return;
        this.complexes.set(complexes);
        if (!complexes.some((item) => item.id === complexId)) {
          this.loading.set(false);
          return;
        }
        this.courtApi.load(complexId).subscribe({
          next: () => this.loading.set(false),
          error: (error: unknown) => this.failLoad(error),
        });
      },
      error: (error: unknown) => this.failLoad(error),
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  openEdit(court: CourtRecord): void {
    this.editing.set(court);
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  save(draft: CourtDraft): void {
    if (!this.formOpen() || this.formClosing() || this.saving()) return;
    const current = this.editing();
    const complexId = this.routeId();
    const request = current
      ? this.courtApi.update(complexId, current.id, draft)
      : this.courtApi.create(complexId, draft);
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.pendingToast = current ? 'Cambios de la cancha guardados.' : 'Cancha agregada.';
        this.closeForm();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.showToast(this.errorMessage(error, draft.imageDataUrl !== null));
        if (error instanceof HttpErrorResponse && error.status === 404) this.load();
      },
    });
  }

  requestDelete(court: CourtRecord): void {
    this.deleteTarget.set(court);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleteTarget.set(null);
    this.courtApi.remove(this.routeId(), target.id).subscribe({
      next: () => this.showToast(`${target.name} se dio de baja.`),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.showToast('No se puede dar de baja esta cancha: tiene reservas futuras.');
          return;
        }
        this.showToast(this.errorMessage(error, false));
        if (error instanceof HttpErrorResponse && error.status === 404) this.load();
      },
    });
  }

  closeForm(): void {
    if (this.formClosing()) return;
    this.formClosing.set(true);
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.closeTimer = setTimeout(() => this.finishFormClose(), reducedMotion ? 0 : 460);
  }

  finishFormClose(): void {
    if (!this.formOpen()) return;
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.formOpen.set(false);
    this.formClosing.set(false);
    this.editing.set(null);
    if (this.pendingToast) {
      this.showToast(this.pendingToast);
      this.pendingToast = '';
    }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }

  private failLoad(error: unknown): void {
    this.loading.set(false);
    this.loadError.set(
      error instanceof HttpErrorResponse && error.status === 403
        ? PERMISSION_ERROR
        : CONNECTION_ERROR,
    );
  }

  private errorMessage(error: unknown, hasImage: boolean): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo completar la acción. Intentá nuevamente.';
    if (error.status === 0) return CONNECTION_ERROR;
    if (error.status === 403) return 'No tenés permisos para esta acción.';
    if (error.status === 404) return 'La cancha ya no existe.';
    if (error.status === 413 || (error.status === 400 && hasImage)) {
      return 'La imagen es demasiado grande o inválida.';
    }
    if (error.status === 400) return 'Revisá los datos de la cancha.';
    return 'No se pudo completar la acción. Intentá nuevamente.';
  }
}
