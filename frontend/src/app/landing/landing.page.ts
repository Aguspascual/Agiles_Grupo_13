import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ClubCardComponent } from './club-card.component';
import { FeaturedCourtsComponent } from './featured-courts.component';
import { LandingFooterComponent } from './landing-footer.component';
import { LandingHeaderComponent } from './landing-header.component';
import { MatchCardComponent } from './match-card.component';
import { MatchDetailDialogComponent } from './match-detail-dialog.component';
import { PadelCourtArtComponent } from './padel-court-art.component';
import { AuthSessionService } from '../auth/auth-session.service';
import { PublicComplex, PublicCourt } from '../complexes/complex.model';
import { ComplexApiService } from '../complexes/complex-api.service';
import { MatchApiService } from '../matches/match-api.service';
import { MatchPreview } from './landing.data';
import { ProfileFeedbackStore } from '../profile/profile-feedback.store';
import { ToastComponent } from '../shared/toast.component';
import { isUrgentMatch } from './urgent-match';

/** Cantidad máxima de partidos en el carrusel de la portada. */
const MAX_RECOMMENDED = 12;

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
    PadelCourtArtComponent,
    ToastComponent,
    MatchDetailDialogComponent,
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
  readonly selectedMatch = signal<MatchPreview | null>(null);
  readonly leavingMatchId = signal<string | null>(null);
  private lastDetailTrigger?: HTMLElement;
  readonly zones = computed(() => [...new Set(this.complexes().map((complex) => complex.zone))].sort());
  readonly levels = computed(() => [...new Set(this.matches().flatMap((match) => match.levels ?? [match.level]))].sort());
  /** Cantidad de canchas publicadas de cada complejo. */
  readonly courtCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const court of this.courts()) counts.set(court.complexId, (counts.get(court.complexId) ?? 0) + 1);
    return counts;
  });
  /** Partidos del carrusel: respetan el filtro elegido y muestran primero los del nivel del jugador. */
  readonly recommendedMatches = computed(() => {
    const matches = this.availableMatches();
    const level = this.session.currentUser()?.level;
    if (!level) return matches.slice(0, MAX_RECOMMENDED);
    const fitsLevel = (match: MatchPreview) => (match.levels ?? [match.level]).includes(level);
    return [...matches.filter(fitsLevel), ...matches.filter((match) => !fitsLevel(match))].slice(0, MAX_RECOMMENDED);
  });
  /** Próximo partido abierto con lugares libres, para el cartel de la cancha del encabezado. */
  readonly nextOpenMatch = computed(() => this.matches().find((match) => match.openSpots > 0) ?? null);
  readonly availableMatches = computed(() => {
    let matches = this.matches();
    if (this.activeFilter() === 'Urgentes') {
      const now = new Date();
      matches = matches.filter((match) => isUrgentMatch(match, now));
    }
    if (this.activeFilter() === 'Completar grupo') matches = matches.filter((match) => match.openSpots > 0);
    return matches;
  });
  readonly stats = computed(() => [
    { value: this.matches().length, label: 'PARTIDOS ABIERTOS', icon: 'ball' },
    { value: this.complexes().length, label: 'CLUBES PUBLICADOS', icon: 'club' },
    { value: new Set(this.matches().flatMap((match) => match.levels ?? [match.level])).size, label: 'NIVELES BUSCADOS', icon: 'level' },
    { value: this.matches().reduce((total, match) => total + match.players.length, 0), label: 'INSCRIPCIONES EN PARTIDOS', icon: 'players' },
  ]);
  readonly availableFilters = ['Todos', 'Urgentes', 'Completar grupo'];
  zone = '';
  level = '';
  date = '';
  readonly activeFilter = signal('Todos');
  /** El buscador arranca plegado y se despliega desde "Buscar partidos". */
  readonly searchOpen = signal(false);

  constructor() {
    this.loadData();
    if (this.toastMessage()) {
      setTimeout(() => {
        this.toastMessage.set('');
        this.feedback.clear();
      }, 3500);
    }
  }

  /** Desplaza el carrusel de recomendados casi un ancho de pantalla. */
  scrollCarousel(track: HTMLElement, direction: 1 | -1): void {
    track.scrollBy?.({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  }

  /** Primer nombre del jugador para el saludo de la portada. */
  firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? '';
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
        this.matches.set(matches);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
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
    this.matchesApi.join(match.id).subscribe({
      next: (updated) => {
        this.selectedMatch.set(updated);
        this.showToast(`Te sumaste al partido en ${updated.club}.`);
        this.refreshMatches();
      },
      error: () => this.showToast('No pudimos sumarte al partido. Intentá nuevamente.'),
    });
  }

  leaveMatch(match: MatchPreview): void {
    if (this.leavingMatchId()) return;
    this.leavingMatchId.set(match.id);
    this.matchesApi.leave(match.id).subscribe({
      next: (result) => {
        this.leavingMatchId.set(null);
        this.closeDetails();
        this.showToast(result.deleted ? 'Te bajaste del partido. El partido se eliminó y el turno quedó libre.' : 'Te bajaste del partido. Tu lugar quedó disponible.');
        this.refreshMatches();
      },
      error: () => {
        this.leavingMatchId.set(null);
        this.showToast('No pudimos procesar la baja. Intentá otra vez.');
        this.refreshMatches();
      },
    });
  }

  private refreshMatches(): void {
    this.matchesApi.list().subscribe({ next: (matches) => this.matches.set(matches) });
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(''), 3500);
  }

  dismissToast(): void {
    this.toastMessage.set('');
    this.feedback.clear();
  }
}
