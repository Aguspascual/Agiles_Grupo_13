import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ReservationApiService } from '../bookings/reservation-api.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { toDateKey } from '../shared/local-date';
import { MatchApiService } from './match-api.service';
import { AvailabilityOption, ComplexOption } from './match-api.model';

@Component({
  selector: 'app-create-match-dialog',
  imports: [FormsModule, RouterLink],
  templateUrl: './create-match-dialog.component.html',
  styleUrl: './create-match-dialog.component.scss',
})
export class CreateMatchDialogComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  private readonly matchesApi = inject(MatchApiService);
  private readonly reservationsApi = inject(ReservationApiService);
  readonly session = inject(AuthSessionService);
  private availabilityRequest?: Subscription;

  readonly levels = ['Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'];
  readonly minDate = toDateKey(new Date());
  readonly maxDate = futureDateKey(13);
  mode: 'complete' | 'open' = 'open';
  complexes: ComplexOption[] = [];
  complexId = '';
  courtId = '';
  date = this.minDate;
  startsAt = '';
  targetLevel = this.session.currentUser()?.level ?? '5ta';
  phone = '';
  slots: AvailabilityOption[] = [];
  loadingOptions = true;
  loadingSlots = false;
  saving = false;
  errorMessage = '';

  ngOnInit(): void {
    this.matchesApi.complexes().subscribe({
      next: (items) => {
        this.complexes = items;
        this.loadingOptions = false;
        this.complexId = items[0]?.id ?? '';
        this.courtId = this.selectedComplex?.courts[0]?.id ?? '';
        this.loadSlots();
      },
      error: () => {
        this.loadingOptions = false;
        this.errorMessage = 'No pudimos cargar los complejos. Intentá nuevamente.';
      },
    });
  }

  get selectedComplex(): ComplexOption | undefined {
    return this.complexes.find((item) => item.id === this.complexId);
  }

  get availableSlots(): AvailabilityOption[] {
    return this.slots.filter((slot) => slot.status === 'AVAILABLE' && !slot.isPast);
  }

  changeComplex(id: string): void {
    this.complexId = id;
    this.courtId = this.selectedComplex?.courts[0]?.id ?? '';
    this.startsAt = '';
    this.loadSlots();
  }

  changeCourt(id: string): void {
    this.courtId = id;
    this.startsAt = '';
    this.loadSlots();
  }

  changeDate(date: string): void {
    this.date = date;
    this.startsAt = '';
    this.loadSlots();
  }

  loadSlots(): void {
    this.availabilityRequest?.unsubscribe();
    this.errorMessage = '';
    if (!this.complexId || !this.date) {
      this.slots = [];
      return;
    }
    this.loadingSlots = true;
    this.availabilityRequest = this.matchesApi.availability(this.complexId, this.date).subscribe({
      next: (byCourt) => {
        this.slots = byCourt.get(this.courtId) ?? [];
        this.loadingSlots = false;
      },
      error: () => {
        this.slots = [];
        this.loadingSlots = false;
        this.errorMessage = 'No se pudo consultar la disponibilidad de esa fecha.';
      },
    });
  }

  submit(): void {
    if (this.saving || !this.complexId || !this.courtId || !this.startsAt) return;
    const user = this.session.currentUser();
    if (!user) {
      this.errorMessage = 'Iniciá sesión para crear un partido.';
      return;
    }
    this.errorMessage = '';
    if (this.mode === 'complete' && !this.phone.trim()) {
      this.errorMessage = 'Ingresá un teléfono de contacto para el complejo.';
      return;
    }
    this.saving = true;
    let request: Observable<unknown>;
    if (this.mode === 'open') {
      request = this.matchesApi.createOpen(this.complexId, this.courtId, { date: this.date, startsAt: this.startsAt, targetLevel: this.targetLevel });
    } else {
      request = this.reservationsApi.reserveGroup(this.complexId, this.courtId, {
        date: this.date,
        startsAt: this.startsAt,
        contact: { name: user.name, phone: this.phone.trim() },
      });
    }
    request.subscribe({
      next: () => {
        this.saving = false;
        this.created.emit();
      },
      error: (error: { status?: number }) => {
        this.saving = false;
        this.errorMessage = error.status === 409
          ? 'Ese horario acaba de ocuparse. Elegí otro turno.'
          : error.status === 401
            ? 'Tu sesión venció. Ingresá nuevamente para continuar.'
            : 'No pudimos registrar el partido. Revisá los datos e intentá otra vez.';
        if (error.status === 409) this.loadSlots();
      },
    });
  }

  ngOnDestroy(): void {
    this.availabilityRequest?.unsubscribe();
  }
}

function futureDateKey(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
