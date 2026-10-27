import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClubCardComponent } from './club-card.component';
import { LandingFooterComponent } from './landing-footer.component';
import {
  FEATURED_CLUBS,
  HOME_MATCHES,
  LEVELS,
  MatchPreview,
  RECOMMENDED_MATCHES,
  ZONES,
} from './landing.data';
import { LandingHeaderComponent } from './landing-header.component';
import { MatchCardComponent } from './match-card.component';
import { CreateMatchModalStore } from '../create-match/create-match-modal.store';

@Component({
  selector: 'app-landing-page',
  imports: [
    FormsModule,
    RouterLink,
    LandingHeaderComponent,
    LandingFooterComponent,
    MatchCardComponent,
    ClubCardComponent,
  ],
  templateUrl: './landing.page.html',
})
export class LandingPage {
  private readonly createMatchModal = inject(CreateMatchModalStore);
  readonly zones = ZONES;
  readonly levels = LEVELS;
  readonly recommendedMatches = RECOMMENDED_MATCHES;
  readonly featuredClubs = FEATURED_CLUBS;
  readonly availableFilters = [
    'Todos (42)',
    'Urgentes: falta 1',
    'City Bell & Gonnet',
    'Casco Urbano',
    'Turnos nocturnos',
  ];
  zone = 'Casco Urbano';
  level = '5ta';
  date = 'Hoy (Tarde/Noche)';
  activeFilter = 'Todos (42)';

  openCreateMatch(): void {
    this.createMatchModal.open();
  }

  get availableMatches(): MatchPreview[] {
    if (this.activeFilter === 'Urgentes: falta 1')
      return HOME_MATCHES.filter((match) => match.openSpots === 1);
    if (this.activeFilter === 'City Bell & Gonnet')
      return HOME_MATCHES.filter((match) => ['City Bell', 'Gonnet'].includes(match.zone));
    if (this.activeFilter === 'Casco Urbano')
      return HOME_MATCHES.filter((match) => match.zone === 'Casco Urbano');
    if (this.activeFilter === 'Turnos nocturnos')
      return HOME_MATCHES.filter((match) => Number(match.time.slice(0, 2)) >= 20);
    return HOME_MATCHES;
  }
}
