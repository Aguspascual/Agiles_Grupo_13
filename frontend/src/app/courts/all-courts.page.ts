import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { ToastComponent } from '../shared/toast.component';
import { ComplexApiService } from '../complexes/complex-api.service';
import { ComplexRecord } from '../complexes/complex.model';
import { CourtApiService } from './court-api.service';
import { CourtCardComponent } from './court-card.component';
import { CourtFormDialogComponent } from './court-form-dialog.component';
import { CourtDraft, CourtRecord } from './court.model';

interface ComplexCourts {
  complex: ComplexRecord;
  courts: CourtRecord[];
  failed: boolean;
}

/** Todas las canchas registradas, agrupadas por complejo. */
@Component({
  selector: 'app-all-courts-page',
  standalone: true,
  imports: [RouterLink, ComplexAdminSidebarComponent, CourtCardComponent, CourtFormDialogComponent, ToastComponent],
  templateUrl: './all-courts.page.html',
  styleUrl: './all-courts.page.scss',
})
export class AllCourtsPage implements OnInit, OnDestroy {
  private readonly complexApi = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);

  readonly groups = signal<ComplexCourts[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly editing = signal<CourtRecord | null>(null);
  readonly formClosing = signal(false);
  readonly saving = signal(false);
  readonly toastMessage = signal('');
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingToast = '';

  constructor() {
    inject(Title).setTitle('Canchas | PádelMatch LP');
  }

  ngOnInit(): void {
    this.load();
  }

  openCourt(court: CourtRecord): void {
    this.formClosing.set(false);
    this.editing.set(court);
  }

  closeForm(): void {
    if (this.formClosing()) return;
    this.formClosing.set(true);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.closeTimer = setTimeout(() => this.finishFormClose(), reduced ? 0 : 460);
  }

  finishFormClose(): void {
    clearTimeout(this.closeTimer);
    if (!this.editing()) return;
    this.editing.set(null);
    this.formClosing.set(false);
    if (this.pendingToast) {
      this.showToast(this.pendingToast);
      this.pendingToast = '';
    }
  }

  save(draft: CourtDraft): void {
    const current = this.editing();
    if (!current || this.saving() || this.formClosing()) return;
    this.saving.set(true);
    this.courtApi.update(current.complexId, current.id, draft).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.groups.update((groups) =>
          groups.map((group) => ({ ...group, courts: group.courts.map((court) => (court.id === saved.id ? saved : court)) })),
        );
        this.pendingToast = 'Cambios de la cancha guardados.';
        this.closeForm();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.showToast(
          status === 413 ? 'La imagen es demasiado pesada.' : status === 400 ? 'Revisá los datos de la cancha.' : status === 403 ? 'No tenés permisos para esta acción.' : status === 404 ? 'La cancha ya no existe.' : 'No se pudo guardar la cancha. Intentá nuevamente.',
        );
        if (status === 404) {
          this.finishFormClose();
          this.load();
        }
      },
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.closeTimer);
    clearTimeout(this.toastTimer);
  }

  private showToast(message: string): void {
    clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.complexApi
      .list()
      .pipe(
        switchMap((complexes) =>
          complexes.length
            ? forkJoin(
                complexes.map((complex) =>
                  this.courtApi.list(complex.id).pipe(
                    catchError(() => of(null)),
                  ),
                ),
              ).pipe(
                map((lists) => complexes.map((complex, index): ComplexCourts => ({ complex, courts: lists[index] ?? [], failed: lists[index] === null }))),
              )
            : of([] as ComplexCourts[]),
        ),
      )
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            error instanceof HttpErrorResponse && error.status === 0
              ? 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.'
              : 'No pudimos cargar las canchas. Intentá nuevamente.',
          );
        },
      });
  }
}