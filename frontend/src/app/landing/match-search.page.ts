import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
import { CreateMatchDialogComponent } from '../matches/create-match-dialog.component';

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
  ],
  templateUrl: './match-search.page.html',
})
export class MatchSearchPage implements OnInit, OnDestroy {
  selectedMatch: MatchPreview | null = null;
  toastMessage = '';
  private lastDetailTrigger: HTMLElement | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;
  readonly matches: MatchPreview[] = [];
  readonly session = inject(AuthSessionService);
  private readonly api = inject(MatchApiService);
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
  selectedDay = 'Hoy';
  dayFilterEnabled = false;
  selectedTimes = ['Noche (18:00 - 00:00)'];
  selectedFeatures: string[] = [];
  selectedClub = 'Todos los clubes de La Plata';
  onlyOpen = true;
  filtersOpen = false;
  loadingMatches = true;
  matchesError = '';
  createDialogOpen = false;

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
    this.selectedMatch = detail.match;
  }

  closeDetails(): void {
    this.selectedMatch = null;
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
              const index = this.matches.findIndex((item) => item.id === updated.id);
              if (index >= 0) this.matches.splice(index, 1, updated);
            }
            this.showToast(`Te sumaste al partido en ${updated.club}.`);
          },
          error: (error: unknown) => this.showToast(this.matchActionError(error)),
        });
      },
      error: () => void this.router.navigate(['/ingresar'], { queryParams: { returnUrl: '/partidos' } }),
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

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  ngOnInit(): void {
    this.loadMatches();
    this.route.queryParams.subscribe((params) => {
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
      const zone = this.zones.find(
        (item) => item.toLowerCase() === String(params['zona'] ?? '').toLowerCase(),
      );
      const level = this.levels.find(
        (item) => item.toLowerCase() === String(params['nivel'] ?? '').toLowerCase(),
      );
      if (zone) this.selectedZones = [zone];
      if (level) this.selectedLevels = [level];
      const club = this.matches.find(
        (item) => item.club.toLowerCase() === String(params['club'] ?? '').toLowerCase(),
      );
      if (club) this.selectedClub = club.club;
      if (params['fecha']) {
        this.selectedDay = String(params['fecha']).startsWith('Mañana') ? 'Mañana' : 'Hoy';
        this.dayFilterEnabled = true;
      }
    });
  }

  loadMatches(): void {
    this.loadingMatches = true;
    this.matchesError = '';
    this.api.list().subscribe({
      next: (matches) => {
        this.matches.splice(0, this.matches.length, ...matches);
        this.loadingMatches = false;
      },
      error: () => {
        this.loadingMatches = false;
        this.matchesError = 'No pudimos cargar los partidos. Revisá tu conexión e intentá de nuevo.';
      },
    });
  }

  private removeMatch(id: string): void {
    const index = this.matches.findIndex((item) => item.id === id);
    if (index >= 0) this.matches.splice(index, 1);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = ''), 3500);
  }

  private matchActionError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) return 'El partido ya está completo o ya estás anotado.';
    if (error instanceof HttpErrorResponse && error.status === 401) return 'Tu sesión venció. Iniciá sesión nuevamente.';
    return 'No pudimos completar la acción. Intentá otra vez.';
  }

  get activeFiltersCount(): number {
    return (
      Number(this.onlyOpen) +
      this.selectedZones.length +
      this.selectedLevels.length +
      Number(this.dayFilterEnabled) +
      this.selectedTimes.length +
      this.selectedFeatures.length +
      Number(this.selectedClub !== 'Todos los clubes de La Plata')
    );
  }

  get filteredMatches(): MatchPreview[] {
    return this.matches.filter(
      (match) =>
        (!this.selectedZones.length || this.selectedZones.includes(match.zone)) &&
        (!this.selectedLevels.length || this.selectedLevels.includes(match.level)) &&
        (!this.dayFilterEnabled ||
          this.selectedDay === 'Todos' ||
          this.matchesSelectedDay(match)) &&
        (!this.selectedClub ||
          this.selectedClub === 'Todos los clubes de La Plata' ||
          match.club === this.selectedClub) &&
        (!this.onlyOpen || match.openSpots > 0) &&
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
    this.selectedClub = 'Todos los clubes de La Plata';
    this.onlyOpen = true;
  }
}
