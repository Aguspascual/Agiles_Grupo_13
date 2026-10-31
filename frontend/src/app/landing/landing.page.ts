import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ClubCardComponent } from './club-card.component';
import { FeaturedCourtsComponent } from './featured-courts.component';
import { LandingFooterComponent } from './landing-footer.component';
import { LandingHeaderComponent } from './landing-header.component';
import { MatchCardComponent } from './match-card.component';
import { AuthSessionService } from '../auth/auth-session.service';
import { PublicComplex, PublicCourt } from '../complexes/complex.model';
import { ComplexApiService } from '../complexes/complex-api.service';
import { MatchApiService } from '../matches/match-api.service';
import { MatchPreview } from './landing.data';
import { ProfileFeedbackStore } from '../profile/profile-feedback.store';
import { ToastComponent } from '../shared/toast.component';

@Component({
  selector: 'app-landing-page',
  imports: [
    FormsModule,
    RouterLink,
    LandingHeaderComponent,
    LandingFooterComponent,
    MatchCardComponent,
    ClubCardComponent,
    FeaturedCourtsComponent,
    ToastComponent,
  ],
  templateUrl: './landing.page.html',
})
export class LandingPage {
  readonly session = inject(AuthSessionService);
  private readonly complexesApi = inject(ComplexApiService);
  private readonly matchesApi = inject(MatchApiService);
  private readonly feedback = inject(ProfileFeedbackStore);
  readonly toastMessage = signal(this.feedback.saveNotice());
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly complexes = signal<PublicComplex[]>([]);
  readonly courts = signal<PublicCourt[]>([]);
  readonly matches = signal<MatchPreview[]>([]);
  readonly zones = computed(() => [...new Set(this.complexes().map((complex) => complex.zone))].sort());
  readonly levels = computed(() => [...new Set(this.matches().map((match) => match.level))].sort());
  /** Cantidad de canchas publicadas de cada complejo. */
  readonly courtCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const court of this.courts()) counts.set(court.complexId, (counts.get(court.complexId) ?? 0) + 1);
    return counts;
  });
  readonly recommendedMatches = computed(() => {
    const all = this.matches();
    const level = this.session.currentUser()?.level;
    return (level ? all.filter((match) => match.level === level) : all).slice(0, 3);
  });
  readonly availableMatches = computed(() => {
    let matches = this.matches();
    if (this.activeFilter === 'Urgentes') matches = matches.filter((match) => match.openSpots === 1);
    if (this.activeFilter === 'Completar grupo') matches = matches.filter((match) => match.openSpots > 0);
    return matches;
  });
  readonly stats = computed(() => [
    { value: this.matches().length, label: 'PARTIDOS ABIERTOS', icon: '⌁' },
    { value: this.complexes().length, label: 'CLUBES PUBLICADOS', icon: '▦' },
    { value: new Set(this.matches().map((match) => match.level)).size, label: 'NIVELES BUSCADOS', icon: '◎' },
    { value: this.matches().reduce((total, match) => total + match.players.length, 0), label: 'INSCRIPCIONES EN PARTIDOS', icon: '♙' },
  ]);
  readonly availableFilters = ['Todos', 'Urgentes', 'Completar grupo'];
  zone = '';
  level = '';
  date = '';
  activeFilter = 'Todos';

  constructor() {
    this.loadData();
    if (this.toastMessage()) {
      setTimeout(() => {
        this.toastMessage.set('');
        this.feedback.clear();
      }, 3500);
    }
  }

  loadData(): void {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      complexes: this.complexesApi.listPublic(),
      matches: this.matchesApi.list(),
      // Las canchas solo enriquecen la portada: si fallan, se muestran igual los complejos.
      courts: this.complexesApi.listPublicCourts().pipe(catchError(() => of([] as PublicCourt[]))),
    }).subscribe({
      next: ({ complexes, matches, courts }) => {
        this.complexes.set(complexes);
        this.courts.set(courts);
        // La API aún no ofrece fotografías; no usar la imagen de presentación del mapper.
        this.matches.set(matches.map((match) => ({ ...match, image: '' })));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  dismissToast(): void {
    this.toastMessage.set('');
    this.feedback.clear();
  }
}
