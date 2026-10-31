import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { SelectMenuComponent, SelectOption } from '../shared/select-menu.component';
import { toDateKey } from '../shared/local-date';
import { MatchApiService } from './match-api.service';
import { FullMatch, FullMatchApiService } from './full-match-api.service';
import { FullMatchCreatedComponent } from './full-match-created.component';
import { InviteeAutocompleteComponent, InviteeDraft } from './invitee-autocomplete.component';
import { AvailabilityOption, ComplexOption } from './match-api.model';
import { CourtPositionPickerComponent } from './court-position-picker.component';

@Component({
  selector: 'app-create-match-dialog',
  imports: [FormsModule, RouterLink, FullMatchCreatedComponent, InviteeAutocompleteComponent, SelectMenuComponent, MultiSelectComponent, CourtPositionPickerComponent],
  templateUrl: './create-match-dialog.component.html',
  styleUrl: './create-match-dialog.component.scss',
})
export class CreateMatchDialogComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();
  @Output() fullMatchCreated = new EventEmitter<void>();

  private readonly matchesApi = inject(MatchApiService);
  private readonly fullMatchApi = inject(FullMatchApiService);
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
  /** Hasta tres niveles buscados; por defecto, el del organizador. */
  targetLevels: string[] = [this.session.currentUser()?.level ?? '5ta'];
  readonly maxLevels = 3;
  /** Lugar del organizador en la cancha (1 y 2: pareja A, 3 y 4: pareja B). */
  slot: number | null = this.session.currentUser()?.position === 'Revés' ? 2 : 1;
  phone = '';
  invitees: InviteeDraft[] = Array.from({ length: 3 }, () => ({ query: '', selected: null }));
  createdFullMatch: FullMatch | null = null;
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
    return this.slots.filter((slot) => {
      if (slot.status !== 'AVAILABLE' || slot.isPast) return false;
      if (this.mode !== 'complete') return true;
      return this.slotDate(slot.startsAt).getTime() >= Date.now() + 30 * 60 * 1000;
    });
  }

  get complexOptions(): SelectOption[] {
    return this.complexes.map((complex) => ({ value: complex.id, label: `${complex.name} · ${complex.zone}` }));
  }

  get courtOptions(): SelectOption[] {
    return (this.selectedComplex?.courts ?? []).map((court) => ({ value: court.id, label: `${court.name} · ${court.covered ? 'Techada' : 'Aire libre'}` }));
  }

  get slotOptions(): SelectOption[] {
    return this.availableSlots.map((slot) => ({ value: slot.startsAt, label: `${slot.startsAt}-${slot.endsAt}` }));
  }

  get levelOptions(): MultiSelectOption[] {
    return this.levels.map((level) => ({ value: level, label: level }));
  }

  get initials(): string {
    const name = this.session.currentUser()?.name ?? '';
    return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'Vos';
  }

  /** Jugadores que no deben ofrecerse en un lugar de invitado: el organizador y los ya elegidos en los demás. */
  excludedFor(index: number): string[] {
    const ids = this.invitees.filter((_, position) => position !== index).map((invite) => invite.selected?.id).filter((id): id is string => !!id);
    const organizer = this.session.currentUser()?.id;
    return organizer ? [...ids, organizer] : ids;
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

  updateInvitee(index: number, invitee: InviteeDraft): void {
    this.invitees[index] = invitee;
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
    let request: Observable<unknown>;
    if (this.mode === 'open') {
      if (!this.targetLevels.length) {
        this.errorMessage = 'Elegí al menos un nivel buscado.';
        return;
      }
      request = this.matchesApi.createOpen(this.complexId, this.courtId, {
        date: this.date,
        startsAt: this.startsAt,
        targetLevel: this.targetLevels[0],
        targetLevels: this.targetLevels,
        ...(this.slot ? { slot: this.slot } : {}),
      });
    } else {
      if (this.invitees.some((invite) => !invite.query.trim())) {
        this.errorMessage = 'Buscá o ingresá a tus tres invitados.';
        return;
      }
      request = this.fullMatchApi.create(this.complexId, this.courtId, {
        date: this.date,
        startsAt: this.startsAt,
        phone: this.phone.trim(),
        invites: this.invitees.map((invite) => {
          const value = invite.query.trim();
          return invite.selected
            ? { name: invite.selected.name, email: '', userId: invite.selected.id }
            : { name: value, email: isEmail(value) ? value : '' };
        }),
      });
    }
    this.saving = true;
    request.subscribe({
      next: (result) => {
        this.saving = false;
        if (this.mode === 'complete') {
          this.createdFullMatch = result as FullMatch;
          this.fullMatchCreated.emit();
        } else {
          this.created.emit();
        }
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

  private slotDate(time: string): Date {
    const [year, month, day] = this.date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function futureDateKey(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
