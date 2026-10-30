import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CourtApiService } from '../courts/court-api.service';
import { ComplexApiService } from './complex-api.service';
import { ComplexFormDialogComponent } from './complex-form-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ComplexDraft, ComplexRecord, ManagerOption } from './complex.model';

export interface OverviewCourt {
  id: string;
  name: string;
  covered: boolean;
}

/** Cabecera de la vista completa de un complejo: datos, edición, baja y cierre de canchas. */
@Component({
  selector: 'app-complex-overview',
  standalone: true,
  imports: [RouterLink, ComplexFormDialogComponent, ConfirmDialogComponent],
  templateUrl: './complex-overview.component.html',
  styleUrl: './complex-overview.component.scss',
})
export class ComplexOverviewComponent implements OnInit {
  private readonly api = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);
  private readonly router = inject(Router);

  @Input({ required: true }) complexId = '';
  @Input() courts: OverviewCourt[] = [];
  @Input() fallbackName = '';
  @Output() courtsChanged = new EventEmitter<void>();
  @Output() notify = new EventEmitter<string>();

  readonly complex = signal<ComplexRecord | null>(null);
  readonly managers = signal<ManagerOption[]>([]);
  readonly isAdmin = signal(false);
  readonly formOpen = signal(false);
  readonly formClosing = signal(false);
  readonly formError = signal('');
  readonly saving = signal(false);
  readonly deleteOpen = signal(false);
  readonly courtTarget = signal<OverviewCourt | null>(null);

  private pendingNotice = '';

  ngOnInit(): void {
    forkJoin({
      complexes: this.api.list(),
      managers: this.api.availableManagers().pipe(
        catchError(() => of(null)),
      ),
    }).subscribe({
      next: ({ complexes, managers }) => {
        const current = complexes.find((item) => item.id === this.complexId) ?? null;
        this.complex.set(current);
        this.isAdmin.set(managers !== null);
        this.managers.set(managers ?? current?.managers ?? []);
      },
      error: () => this.complex.set(null),
    });
  }

  managerName(id: string): string {
    const current = this.complex();
    return this.managers().find((manager) => manager.id === id)?.name
      ?? current?.managers?.find((manager) => manager.id === id)?.name
      ?? 'Encargado';
  }

  openEdit(): void {
    this.formError.set('');
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (!this.formClosing()) this.formClosing.set(true);
  }

  finishFormClose(): void {
    this.formOpen.set(false);
    this.formClosing.set(false);
    if (this.pendingNotice) {
      this.notify.emit(this.pendingNotice);
      this.pendingNotice = '';
    }
  }

  save(draft: ComplexDraft): void {
    const current = this.complex();
    if (!current || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    this.api.update(current.id, draft).subscribe({
      next: (saved) => {
        this.complex.set(saved);
        this.managers.update((list) => [...new Map([...list, ...(saved.managers ?? [])].map((item) => [item.id, item])).values()]);
        this.pendingNotice = 'Cambios del complejo guardados.';
        this.saving.set(false);
        this.closeForm();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(
          error instanceof HttpErrorResponse && error.status === 0
            ? 'No se pudo conectar con el servidor.'
            : 'No se pudo guardar el complejo. Revisá los datos e intentá de nuevo.',
        );
      },
    });
  }

  confirmDeleteComplex(): void {
    const current = this.complex();
    if (!current || !this.isAdmin()) return;
    this.api.remove(current.id).subscribe({
      next: () => void this.router.navigateByUrl('/admin/complejos'),
      error: () => {
        this.deleteOpen.set(false);
        this.notify.emit('No se pudo dar de baja el complejo.');
      },
    });
  }

  confirmCloseCourt(): void {
    const court = this.courtTarget();
    if (!court) return;
    this.courtTarget.set(null);
    this.courtApi.remove(this.complexId, court.id).subscribe({
      next: () => {
        this.notify.emit(`${court.name} se cerró correctamente.`);
        this.courtsChanged.emit();
      },
      error: (error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.notify.emit(
          status === 409
            ? 'No se puede cerrar esta cancha: tiene reservas futuras.'
            : status === 404
              ? 'La cancha ya no existe.'
              : 'No se pudo cerrar la cancha. Intentá nuevamente.',
        );
        if (status === 404) this.courtsChanged.emit();
      },
    });
  }
}