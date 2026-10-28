import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LandingFooterComponent } from './landing-footer.component';
import { LEVELS, MATCHES, MatchPreview, ZONES } from './landing.data';
import { LandingHeaderComponent } from './landing-header.component';
import { MatchCardComponent } from './match-card.component';
import { PendingMatchMembershipCardComponent } from '../bookings/pending-match-membership-card.component';

@Component({
  selector: 'app-match-search-page',
  imports: [
    FormsModule,
    RouterLink,
    LandingHeaderComponent,
    LandingFooterComponent,
    MatchCardComponent,
    PendingMatchMembershipCardComponent,
  ],
  templateUrl: './match-search.page.html',
})
export class MatchSearchPage implements OnInit {
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
  selectedZones: string[] = [];
  selectedLevels: string[] = [];
  selectedDay = 'Hoy';
  dayFilterEnabled = false;
  selectedTimes = ['Noche (18:00 - 00:00)'];
  selectedFeatures: string[] = [];
  selectedClub = 'Todos los clubes de La Plata';
  onlyOpen = true;
  filtersOpen = false;

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
    return this.matches.filter(
      (match) =>
        match.id !== 'gonnet-2030' &&
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
