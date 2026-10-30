import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchPreview } from './landing.data';
import { AuthSessionService } from '../auth/auth-session.service';

@Component({
  selector: 'app-match-card',
  imports: [RouterLink],
  template: `
    <article
      class="match-card"
      [class.match-card--search]="searchMode"
      [attr.data-match-card]="match.id"
    >
      <header class="match-card__top">
        <span class="match-card__time">{{ match.day }} · {{ match.time }}</span>
        <span class="match-card__duration">{{ match.duration }}</span>
        <span class="match-card__availability" [class.is-full]="match.openSpots === 0">
          {{
            match.openSpots === 0
              ? 'Completo'
              : match.openSpots === 1
                ? 'Falta 1'
                : match.openSpots + ' faltan'
          }}
        </span>
      </header>
      @if (searchMode && match.image) {
        <img class="match-card__image" [src]="match.image" [alt]="match.imageAlt" loading="lazy" />
      }
      <div class="match-card__club">
        <div>
          <h3>{{ match.club }}</h3>
          <p>{{ match.address }} · {{ match.zone }}</p>
        </div>
        @if (match.price) { <strong>{{ match.price }}<small> / jugador</small></strong> }
      </div>
      <div class="match-card__players">
        <span class="match-card__label">Jugadores confirmados ({{ match.players.length }}/4)</span>
        <div class="match-card__player-grid">
          @for (player of match.players; track player.initials) {
            <span class="player-chip"
              ><i [class]="'player-chip__avatar tone-' + player.tone">{{ player.initials }}</i
              ><span
                ><b>{{ player.name }}</b
                  ><small>Nivel {{ playerLevel(player.name, player.level) }}</small></span
              ></span
            >
          }
          @for (slot of emptySlots; track $index) {
            <span class="player-chip player-chip--empty"
              ><i aria-hidden="true">+</i
              ><span><b>Lugar libre</b><small>Sumate a jugar</small></span></span
            >
          }
        </div>
      </div>
      <footer class="match-card__bottom">
        @if (match.features[0]) {
          <span class="match-card__feature"><i aria-hidden="true">⌁</i>{{ match.features[0] }}</span>
        } @else { <span></span> }
        @if (detailsMode) {
          <button type="button" class="match-card__details" data-match-detail (click)="openDetails($event)" [attr.aria-label]="'Ver detalle del partido en ' + match.club">
            Ver partido <span aria-hidden="true">↗</span>
          </button>
        } @else if (browseMode) {
          <a class="match-card__details" routerLink="/partidos">Ver partido <span aria-hidden="true">→</span></a>
        } @else {
          <button type="button" data-match-action [disabled]="actionCompleted" (click)="completeDemoAction()" [attr.aria-label]="actionLabel + ' · ' + match.club">
            {{ actionLabel }} <span aria-hidden="true">→</span>
          </button>
        }
      </footer>
    </article>
  `,
  styleUrl: './match-card.component.scss',
})
export class MatchCardComponent {
  private readonly session = inject(AuthSessionService);
  @Input({ required: true }) match!: MatchPreview;
  @Input() searchMode = false;
  @Input() detailsMode = false;
  @Input() browseMode = false;
  @Output() viewDetails = new EventEmitter<{ match: MatchPreview; trigger: HTMLElement }>();
  actionCompleted = false;

  get actionLabel(): string {
    if (this.actionCompleted) return this.match.openSpots ? 'Solicitud enviada' : 'Aviso activado';
    return this.match.openSpots === 0 ? 'Ver suplentes' : 'Unirme ahora';
  }

  completeDemoAction(): void {
    this.actionCompleted = true;
  }

  openDetails(event: Event): void {
    this.viewDetails.emit({ match: this.match, trigger: event.currentTarget as HTMLElement });
  }

  playerLevel(playerName: string, fixtureLevel: string): string {
    const user = this.session.currentUser();
    if (!user || this.displayName(user.name) !== playerName) return fixtureLevel;
    return user.level;
  }

  private displayName(name: string): string {
    const [firstName, ...surnames] = name.trim().split(/\s+/);
    return surnames.length ? `${firstName} ${surnames[0][0]}.` : firstName;
  }

  get emptySlots(): number[] {
    return Array.from({ length: Math.max(0, this.match.openSpots) });
  }
}
