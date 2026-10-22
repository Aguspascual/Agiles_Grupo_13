import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ToastComponent } from '../shared/toast.component';
import { ComplexPreviewStore } from '../complexes/complex-preview.store';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { CourtCardComponent } from './court-card.component';
import { CourtFormDialogComponent } from './court-form-dialog.component';
import { DemoRole } from '../complexes/complex.model';
import { CourtDraft, CourtRecord } from './court.model';
import { CourtPreviewStore } from './court-preview.store';

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
  private readonly complexStore = inject(ComplexPreviewStore);
  private readonly courtStore = inject(CourtPreviewStore);
  private readonly routeId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('complexId') ?? '')),
    {
      initialValue: this.route.snapshot.paramMap.get('complexId') ?? '',
    },
  );
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingToast = '';

  readonly complex = computed(
    () => this.complexStore.complexes().find((item) => item.id === this.routeId()) ?? null,
  );
  readonly currentComplexId = this.routeId;
  readonly managers = this.complexStore.managers;
  readonly role = signal<DemoRole>('admin');
  readonly managerId = signal(this.managers[0].id);
  readonly courts = computed(() => this.courtStore.forComplex(this.routeId()));
  readonly formOpen = signal(false);
  readonly formClosing = signal(false);
  readonly editing = signal<CourtRecord | null>(null);
  readonly deleteTarget = signal<CourtRecord | null>(null);
  readonly toastMessage = signal('');

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
    if (!this.formOpen() || this.formClosing()) return;
    const current = this.editing();
    if (current) {
      this.courtStore.update(current.id, draft);
      this.pendingToast = 'Cambios de la cancha guardados en esta vista.';
    } else {
      this.courtStore.create(this.routeId(), draft);
      this.pendingToast = 'Cancha agregada en esta vista.';
    }
    this.closeForm();
  }

  requestDelete(court: CourtRecord): void {
    if (court.hasFutureReservations) {
      this.showToast('No se puede dar de baja esta cancha: tiene reservas futuras.');
      return;
    }
    this.deleteTarget.set(court);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    const removed = this.courtStore.remove(target.id);
    this.showToast(
      removed
        ? `${target.name} se dio de baja en esta vista.`
        : 'No se puede dar de baja esta cancha: tiene reservas futuras.',
    );
    this.deleteTarget.set(null);
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
}
