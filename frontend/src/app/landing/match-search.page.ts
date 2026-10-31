import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSessionService } from '../auth/auth-session.service';
import { LandingFooterComponent } from './landing-footer.component';
import { LEVELS, MatchPreview, ZONES } from './landing.data';
import { LandingHeaderComponent } from './landing-header.component';
import { MatchCardComponent } from './match-card.component';
import { MatchDetailDialogComponent } from './match-detail-dialog.component';
import { ToastComponent } from '../shared/toast.component';
import { MatchApiService } from '../matches/match-api.service';
import { ComplexApiService } from '../complexes/complex-api.service';
import { SelectMenuComponent, SelectOption } from '../shared/select-menu.component';
import { CreateMatchDialogComponent } from '../matches/create-match-dialog.component';

const ALL_CLUBS = 'Todos los clubes de La Plata';

@Component({
  selector: 'app-match-search-page',
  imports: [
    FormsModule,
    RouterLink,
    LandingHeaderComponent,
    LandingFooterComponent,
    MatchCardComponent,
    MatchDetailDialogComponent,
    CreateMatchDialogComponent,
    ToastComponent,
    SelectMenuComponent,
  ],
  templateUrl: './match-search.page.html',
})
export class MatchSearchPage implements OnInit, OnDestroy {
  readonly selectedMatch = signal<MatchPreview | null>(null);
  readonly toastMessage = signal('');
  private lastDetailTrigger: HTMLElement | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;
  readonly matches = signal<MatchPreview[]>([]);
  readonly session = inject(AuthSessionService);
  private readonly api = inject(MatchApiService);
  private readonly complexesApi = inject(ComplexApiService);
  private readonly router = inject(Router);
  readonly zones = ZONES;
  readonly levels = LEVELS;
  readonly days = ['Hoy', 'Mañana', 'Viernes', 'Sábado', 'Domingo'];
  readonly preferredTimes = [
    'Mañana (08:00 - 12:00)',
    'Tarde (12:00 - 18:00)',
    'Noche (18:00 - 00:00)',
  ];
  readonly courtFeatures = [
    'Techado / Indoor',
    'Cristal / Panorámica',
    'Grava sintética',
    'Estacionamiento',
  ];
  selectedZones: string[] = [];
  selectedLevels: string[] = [];
  selectedDay = 'Todos';
  dayFilterEnabled = false;
  selectedTimes: string[] = [];
  selectedFeatures: string[] = [];
  selectedClub = ALL_CLUBS;
  /** Clubes registrados (se leen de la base de datos, no de los partidos publicados). */
  readonly clubOptions = signal<SelectOption[]>([{ value: ALL_CLUBS, label: ALL_CLUBS }]);
  filtersOpen = false;
  readonly loadingMatches = signal(true);
  readonly matchesError = signal('');
  createDialogOpen = false;
  readonly leavingMatchId = signal<string | null>(null);

  constructor(private readonly route: ActivatedRoute) {}

  openFilters(): void {
    this.filtersOpen = true;
  }

  closeFilters(): void {
    this.filtersOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeFiltersOnEscape(): void {
    this.closeFilters();
  }

  openDetails(detail: { match: MatchPreview; trigger: HTMLElement }): void {
    this.lastDetailTrigger = detail.trigger;
    this.selectedMatch.set(detail.match);
  }

  closeDetails(): void {
    this.selectedMatch.set(null);
    setTimeout(() => this.lastDetailTrigger?.focus());
  }

  joinMatch(match: MatchPreview): void {
    this.session.restore().subscribe({
      next: (user) => {
        if (!user) {
          void this.router.navigate(['/ingresar'], { queryParams: { returnUrl: '/partidos' } });
          return;
        }
        this.api.join(match.id).subscribe({
          next: (updated) => {
            if (updated.openSpots === 0) this.removeMatch(updated.id);
            else {
              this.matches.update((matches) => matches.map((item) => item.id === updated.id ? updated : item));
            }
            this.showToast(`Te sumaste al partido en ${updated.club}.`);
          },
          error: (error: unknown) => this.showToast(this.matchActionError(error)),
        });
      },
      error: () => void this.router.navigate(['/ingresar'], { queryParams: { returnUrl: '/partidos' } }),
    });
  }

  leaveMatch(match: MatchPreview): void {
    if (this.leavingMatchId()) return;
    this.leavingMatchId.set(match.id);
    this.api.leave(match.id).subscribe({
      next: (result) => {
        this.leavingMatchId.set(null);
        if (result.deleted) this.removeMatch(match.id);
        this.closeDetails();
        this.showToast(result.deleted
          ? 'Te bajaste del partido. El partido se eliminó y el turno quedó libre.'
          : 'Te bajaste del partido. Tu lugar quedó disponible.');
        this.loadMatches();
      },
      error: (error: unknown) => {
        this.leavingMatchId.set(null);
        this.showToast(this.leaveError(error));
        this.loadMatches();
      },
    });
  }

  closeCreateDialog(): void {
    this.createDialogOpen = false;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { crear: null }, queryParamsHandling: 'merge' });
  }

  onMatchCreated(): void {
    this.closeCreateDialog();
    this.showToast('El partido se registró correctamente.');
    this.loadMatches();
  }

  refreshAfterFullMatch(): void {
    this.loadMatches();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  ngOnInit(): void {
    this.loadMatches();
    this.loadClubs();
    this.route.queryParams.subscribe((params) => {
      const zone = typeof params['zona'] === 'string' ? params['zona'].trim() : '';
      const level = typeof params['nivel'] === 'string' ? params['nivel'].trim() : '';
      const date = typeof params['fecha'] === 'string' ? params['fecha'].trim().toLowerCase() : '';
      if (zone) this.selectedZones = [zone];
      if (level) {
        const knownLevel = this.levels.find((item) => item.toLowerCase() === level.toLowerCase());
        if (knownLevel) this.selectedLevels = [knownLevel];
      }
      if (date === 'hoy' || date === 'mañana') {
        this.selectedDay = date === 'hoy' ? 'Hoy' : 'Mañana';
        this.dayFilterEnabled = true;
      }
      if (params['crear']) {
        this.session.restore().subscribe({
          next: (user) => {
            if (user) {
              this.createDialogOpen = true;
              void this.router.navigate([], { relativeTo: this.route, queryParams: { crear: null }, queryParamsHandling: 'merge' });
            }
            else void this.router.navigate(['/ingresar'], { queryParams: { returnUrl: '/partidos?crear=1' } });
          },
        });
      }
    });
  }

  loadMatches(): void {
    this.loadingMatches.set(true);
    this.matchesError.set('');
    this.session.restore().pipe(
      catchError(() => of(null)),
      switchMap(() => this.api.list()),
    ).subscribe({
      next: (matches) => {
        this.matches.set(matches);
        this.loadingMatches.set(false);
      },
      error: () => {
        this.loadingMatches.set(false);
        this.matchesError.set('No pudimos cargar los partidos. Revisá tu conexión e intentá de nuevo.');
      },
    });
  }

  private removeMatch(id: string): void {
    this.matches.update((matches) => matches.filter((item) => item.id !== id));
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }

  private matchActionError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) return 'El partido ya está completo o ya estás anotado.';
    if (error instanceof HttpErrorResponse && error.status === 401) return 'Tu sesión venció. Iniciá sesión nuevamente.';
    return 'No pudimos completar la acción. Intentá otra vez.';
  }

  private leaveError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) return 'No podés bajarte: la baja cerró 2 horas antes o el partido cambió.';
    if (error instanceof HttpErrorResponse && error.status === 401) return 'Tu sesión venció. Iniciá sesión nuevamente.';
    if (error instanceof HttpErrorResponse && error.status === 404) return 'El partido ya no está disponible.';
    return 'No pudimos procesar la baja. Intentá otra vez.';
  }

  private loadClubs(): void {
    this.complexesApi.listPublic().subscribe({
      next: (complexes) =>
        this.clubOptions.set([
          { value: ALL_CLUBS, label: ALL_CLUBS },
          ...complexes.map((complex) => ({ value: complex.name, label: complex.name })),
        ]),
      error: () => undefined,
    });
  }

  get activeFiltersCount(): number {
    return (
      this.selectedZones.length +
      this.selectedLevels.length +
      Number(this.dayFilterEnabled) +
      this.selectedTimes.length +
      this.selectedFeatures.length +
      Number(this.selectedClub !== ALL_CLUBS)
    );
  }

  get filteredMatches(): MatchPreview[] {
    return this.matches().filter(
      (match) =>
        (!this.selectedZones.length || this.selectedZones.includes(match.zone)) &&
        (!this.selectedLevels.length || (match.levels ?? [match.level]).some((level) => this.selectedLevels.includes(level))) &&
        (!this.dayFilterEnabled ||
          this.selectedDay === 'Todos' ||
          this.matchesSelectedDay(match)) &&
        (!this.selectedClub || this.selectedClub === ALL_CLUBS || match.club === this.selectedClub) &&
        this.matchesPreferredTime(match) &&
        this.selectedFeatures.every((feature) => this.matchesCourtFeature(match, feature)),
    );
  }

  toggleSelection(collection: string[], value: string): string[] {
    return collection.includes(value)
      ? collection.filter((item) => item !== value)
      : [...collection, value];
  }

  private matchesPreferredTime(match: MatchPreview): boolean {
    if (!this.selectedTimes.length) return true;
    const hour = Number(match.time.slice(0, 2));
    return this.selectedTimes.some((time) => {
      if (time.startsWith('Mañana')) return hour >= 8 && hour < 12;
      if (time.startsWith('Tarde')) return hour >= 12 && hour < 18;
      return hour >= 18 || hour < 1;
    });
  }

  private matchesSelectedDay(match: MatchPreview): boolean {
    if (!match.date) return match.day.toLowerCase() === this.selectedDay.toLowerCase();
    const selected = this.selectedDay.toLowerCase();
    if (selected === 'hoy' || selected === 'mañana') {
      const date = new Date(`${match.date}T12:00:00`);
      const target = new Date();
      target.setHours(12, 0, 0, 0);
      if (selected === 'mañana') target.setDate(target.getDate() + 1);
      return date.toDateString() === target.toDateString();
    }
    return new Date(`${match.date}T12:00:00`)
      .toLocaleDateString('es-AR', { weekday: 'long' })
      .toLowerCase() === selected;
  }

  private matchesCourtFeature(match: MatchPreview, feature: string): boolean {
    const terms = feature
      .toLowerCase()
      .split(/[ /]+/)
      .filter((term) => term.length > 2);
    return terms.some((term) => match.features.some((item) => item.toLowerCase().includes(term)));
  }

  clearFilters(): void {
    this.selectedZones = [];
    this.selectedLevels = [];
    this.selectedDay = 'Todos';
    this.dayFilterEnabled = false;
    this.selectedTimes = [];
    this.selectedFeatures = [];
    this.selectedClub = ALL_CLUBS;
  }
}
