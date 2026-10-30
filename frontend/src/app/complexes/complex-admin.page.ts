import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ComplexCardComponent } from './complex-card.component';
import { ComplexAdminSidebarComponent } from './complex-admin-sidebar.component';
import { ComplexFormDialogComponent } from './complex-form-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ComplexDraft, ComplexRecord, DemoRole, ManagerOption } from './complex.model';
import { ComplexApiService } from './complex-api.service';
import { ToastComponent } from '../shared/toast.component';

@Component({
  selector: 'app-complex-admin-page',
  standalone: true,
  imports: [ComplexAdminSidebarComponent, ComplexCardComponent, ComplexFormDialogComponent, ConfirmDialogComponent, ToastComponent],
  templateUrl: './complex-admin.page.html',
  styleUrl: './complex-admin.page.scss',
})
export class ComplexAdminPage implements OnInit, OnDestroy {
  private readonly api = inject(ComplexApiService);
  private readonly router = inject(Router);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingToast = '';

  readonly managers = signal<ManagerOption[]>([]);
  readonly role = signal<DemoRole>('admin');
  readonly isAdmin = signal(false);
  readonly complexes = signal<ComplexRecord[]>([]);
  readonly formOpen = signal(false);
  readonly formClosing = signal(false);
  readonly editing = signal<ComplexRecord | null>(null);
  readonly deleteTarget = signal<ComplexRecord | null>(null);
  readonly toastMessage = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly pageError = signal('');
  readonly formError = signal('');
  readonly visibleComplexes = computed(() => this.complexes());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set('');
    forkJoin({
      complexes: this.api.list(),
      managers: this.api.availableManagers().pipe(catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 403) return of(null);
        throw error;
      })),
    }).subscribe({
      next: ({ complexes, managers }) => {
        this.complexes.set(complexes);
        this.isAdmin.set(managers !== null);
        this.role.set(managers === null ? 'manager' : 'admin');
        this.managers.set(managers ?? assignedManagers(complexes));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.pageError.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Tu cuenta no tiene complejos asignados para gestionar.'
          : 'No se pudieron cargar los complejos. Revisá tu conexión e intentá de nuevo.');
      },
    });
  }

  openCreate(): void {
    if (!this.isAdmin()) return;
    this.editing.set(null);
    this.formError.set('');
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  openEdit(complex: ComplexRecord): void {
    this.editing.set(complex);
    this.formError.set('');
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  openComplex(complex: ComplexRecord): void {
    void this.router.navigate(['/admin/complejos', complex.id]);
  }

  closeForm(): void {
    if (this.formClosing()) return;
    this.formClosing.set(true);
  }

  finishFormClose(): void {
    this.formOpen.set(false);
    this.formClosing.set(false);
    this.editing.set(null);
    if (this.pendingToast) {
      this.showToast(this.pendingToast);
      this.pendingToast = '';
    }
  }

  save(draft: ComplexDraft): void {
    if (this.saving()) return;
    const current = this.editing();
    const request = current ? this.api.update(current.id, draft) : this.api.create(draft);
    this.saving.set(true);
    this.formError.set('');
    request.subscribe({
      next: saved => {
        this.complexes.update(records => current
          ? records.map(item => item.id === saved.id ? saved : item)
          : [...records, saved]);
        this.managers.update(list => mergeManagers(list, saved.managers ?? []));
        this.pendingToast = current ? 'Cambios del complejo guardados.' : 'Complejo creado correctamente.';
        this.saving.set(false);
        this.closeForm();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(apiMessage(error, 'No se pudo guardar el complejo. Revisá los datos e intentá de nuevo.'));
      },
    });
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || !this.isAdmin()) return;
    this.api.remove(target.id).subscribe({
      next: () => {
        this.complexes.update(records => records.filter(item => item.id !== target.id));
        this.showToast(`${target.name} se dio de baja correctamente.`);
        this.deleteTarget.set(null);
      },
      error: (error: unknown) => {
        this.pageError.set(apiMessage(error, 'No se pudo dar de baja el complejo.'));
        this.deleteTarget.set(null);
      },
    });
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

function assignedManagers(complexes: ComplexRecord[]): ManagerOption[] {
  return mergeManagers([], complexes.flatMap(complex => complex.managers ?? []));
}

function mergeManagers(current: ManagerOption[], incoming: ManagerOption[]): ManagerOption[] {
  return [...new Map([...current, ...incoming].map(manager => [manager.id, manager])).values()];
}

function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 0) return 'No se pudo conectar con el servidor.';
  return fallback;
}
