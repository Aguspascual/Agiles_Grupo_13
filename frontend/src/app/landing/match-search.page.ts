import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LandingFooterComponent } from './landing-footer.component';
import { LEVELS, MATCHES, MatchPreview, ZONES } from './landing.data';
import { LandingHeaderComponent } from './landing-header.component';
import { MatchCardComponent } from './match-card.component';
import { MatchDetailDialogComponent } from './match-detail-dialog.component';
import { ToastComponent } from '../shared/toast.component';

@Component({
  selector: 'app-match-search-page',
  imports: [
    FormsModule,
    RouterLink,
    LandingHeaderComponent,
    LandingFooterComponent,
    MatchCardComponent,
    MatchDetailDialogComponent,
    ToastComponent,
  ],
  templateUrl: './match-search.page.html',
})
export class MatchSearchPage implements OnInit, OnDestroy {
  selectedMatch: MatchPreview | null = null;
  toastMessage = '';
  private lastDetailTrigger: HTMLElement | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;
  readonly matches = MATCHES;
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
  searchTerm = '';
  selectedZones: string[] = [];
  selectedLevels: string[] = [];
  selectedDay = 'Hoy';
  dayFilterEnabled = false;
  selectedTimes = ['Noche (18:00 - 00:00)'];
  selectedFeatures: string[] = [];
  selectedClub = 'Todos los clubes de La Plata';
  onlyOpen = true;
  sortBy = 'Más cercanos en horario';
  viewMode: 'grid' | 'list' = 'grid';

  constructor(private readonly route: ActivatedRoute) {}

  openDetails(detail: { match: MatchPreview; trigger: HTMLElement }): void {
    this.lastDetailTrigger = detail.trigger;
    this.selectedMatch = detail.match;
  }

  closeDetails(): void {
    this.selectedMatch = null;
    setTimeout(() => this.lastDetailTrigger?.focus());
  }

  joinMatch(match: MatchPreview): void {
    this.toastMessage = `Solicitud para unirte enviada · ${match.club}`;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = ''), 3500);
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
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
    const term = this.searchTerm.trim().toLowerCase();
    const filtered = this.matches.filter(
      (match) =>
        (!term || `${match.club} ${match.zone} ${match.address}`.toLowerCase().includes(term)) &&
        (!this.selectedZones.length || this.selectedZones.includes(match.zone)) &&
        (!this.selectedLevels.length || this.selectedLevels.includes(match.level)) &&
        (!this.dayFilterEnabled ||
          this.selectedDay === 'Todos' ||
          match.day === this.selectedDay) &&
        (!this.selectedClub ||
          this.selectedClub === 'Todos los clubes de La Plata' ||
          match.club === this.selectedClub) &&
        (!this.onlyOpen || match.openSpots > 0) &&
        this.matchesPreferredTime(match) &&
        this.selectedFeatures.every((feature) => this.matchesCourtFeature(match, feature)),
    );
    return this.sortBy === 'Menor precio'
      ? [...filtered].sort(
          (a, b) => Number(a.price.replace(/\D/g, '')) - Number(b.price.replace(/\D/g, '')),
        )
      : filtered;
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

  private matchesCourtFeature(match: MatchPreview, feature: string): boolean {
    const terms = feature
      .toLowerCase()
      .split(/[ /]+/)
      .filter((term) => term.length > 2);
    return terms.some((term) => match.features.some((item) => item.toLowerCase().includes(term)));
  }

  clearFilters(): void {
    this.searchTerm = '';
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
