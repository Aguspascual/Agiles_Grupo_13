import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CourtScheduleDialogComponent } from '../availability/court-schedule-dialog.component';
import { CourtApiService } from '../courts/court-api.service';
import { CourtFormDialogComponent } from '../courts/court-form-dialog.component';
import { CourtDraft } from '../courts/court.model';
import { SelectMenuComponent, SelectOption } from '../shared/select-menu.component';
import { ComplexApiService } from './complex-api.service';
import { ComplexFormDialogComponent } from './complex-form-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ComplexDraft, ComplexRecord, ManagerOption } from './complex.model';

export interface OverviewCourt {
  id: string;
  name: string;
  covered: boolean;
}

const CREATE_COURT = '__create-court__';

/** Cabecera de la vista completa de un complejo: datos, edición, baja y cierre de canchas. */
@Component({
  selector: 'app-complex-overview',
  standalone: true,
  imports: [RouterLink, ComplexFormDialogComponent, ConfirmDialogComponent, CourtScheduleDialogComponent, CourtFormDialogComponent, SelectMenuComponent],
  templateUrl: './complex-overview.component.html',
  styleUrl: './complex-overview.component.scss',
})
export class ComplexOverviewComponent implements OnInit, OnChanges {
  private readonly api = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);
  private readonly router = inject(Router);

  @Input({ required: true }) complexId = '';
  @Input() courts: OverviewCourt[] = [];
  @Input() courtId = '';
  @Input() fallbackName = '';
  @Output() courtIdChange = new EventEmitter<string>();
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
  readonly courtFormOpen = signal(false);
  readonly courtFormClosing = signal(false);
  readonly courtSaving = signal(false);
  readonly dataOpen = signal(false);
  readonly scheduleOpen = signal(false);

  courtOptions: SelectOption[] = [];
  private pendingNotice = '';
  private createdCourtId = '';

  ngOnChanges(): void {
    this.courtOptions = [...this.courts.map((court) => ({ value: court.id, label: court.name })), { value: CREATE_COURT, label: 'Crear cancha', action: true }];
  }

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

  get selectedCourt(): OverviewCourt | null {
    return this.courts.find((court) => court.id === this.courtId) ?? this.courts[0] ?? null;
  }

  onCourtChange(value: string): void {
    if (value === CREATE_COURT) {
      this.courtFormClosing.set(false);
      this.courtFormOpen.set(true);
      return;
    }
    this.courtIdChange.emit(value);
  }

  closeCourtForm(): void {
    if (!this.courtFormClosing()) this.courtFormClosing.set(true);
  }

  finishCourtFormClose(): void {
    this.courtFormOpen.set(false);
    this.courtFormClosing.set(false);
    if (!this.createdCourtId) return;
    this.courtIdChange.emit(this.createdCourtId);
    this.createdCourtId = '';
    this.notify.emit('Cancha agregada.');
    this.courtsChanged.emit();
  }

  saveCourt(draft: CourtDraft): void {
    if (this.courtSaving() || this.courtFormClosing()) return;
    this.courtSaving.set(true);
    this.courtApi.create(this.complexId, draft).subscribe({
      next: (created) => {
        this.courtSaving.set(false);
        this.createdCourtId = created.id;
        this.closeCourtForm();
      },
      error: (error: unknown) => {
        this.courtSaving.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.notify.emit(status === 413 ? 'La imagen es demasiado pesada.' : status === 400 ? 'Revisá los datos de la cancha.' : status === 403 ? 'No tenés permisos para esta acción.' : 'No se pudo agregar la cancha. Intentá nuevamente.');
      },
    });
  }

  closeSchedule(): void {
    this.scheduleOpen.set(false);
    this.courtsChanged.emit();
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
}
