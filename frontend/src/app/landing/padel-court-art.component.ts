import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatchPreview } from './landing.data';

/**
 * Ilustración de una cancha de pádel vista desde arriba para el encabezado de la portada.
 * Si hay un partido abierto con lugares libres, lo muestra como acceso rápido a su detalle.
 */
@Component({
  selector: 'app-padel-court-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="court-art">
      <svg viewBox="0 0 440 250" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="court-art-ball" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stop-color="#f4ff8a" />
            <stop offset="1" stop-color="#c9e02a" />
          </radialGradient>
          <symbol id="court-art-ball-shape" viewBox="-12 -12 24 24">
            <circle r="11" fill="url(#court-art-ball)" />
            <path d="M-10 -4 C -3 -1, -3 5, -6 9 M10 4 C 3 1, 3 -5, 6 -9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
          </symbol>
        </defs>

        <rect width="440" height="250" rx="14" fill="#0d2920" />

        <!-- Superficie de juego: 20 m x 10 m (19 px por metro) -->
        <rect x="30" y="30" width="380" height="190" rx="4" fill="#11392c" stroke="#2e8e69" stroke-width="2.4" />

        <!-- Vidrios del fondo y de los laterales -->
        <path d="M30 30 V220 M410 30 V220 M30 30 H106 M30 220 H106 M334 30 H410 M334 220 H410" fill="none" stroke="#5ed2a5" stroke-width="4" stroke-linecap="round" opacity="0.55" />

        <!-- Líneas de saque y línea central -->
        <path d="M88 30 V220 M352 30 V220 M88 125 H352" fill="none" stroke="#2e8e69" stroke-width="2.4" />

        <!-- Red -->
        <path d="M220 26 V224" stroke="#5ed2a5" stroke-width="4" stroke-linecap="round" />

        <!-- Recorrido de la pelota -->
        <path class="court-art__trail" d="M118 182 Q 205 40 302 92" fill="none" stroke="#d7ee3b" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" opacity="0.85" />
        <ellipse cx="302" cy="104" rx="10" ry="3" fill="#06180f" opacity="0.5" />
        <use class="court-art__ball court-art__ball--main" href="#court-art-ball-shape" x="290" y="78" width="24" height="24" />
        <use class="court-art__ball" href="#court-art-ball-shape" x="108" y="172" width="18" height="18" opacity="0.9" />
      </svg>
      @if (match) {
        <figcaption class="court-art__caption">
          <button type="button" (click)="open.emit({ match: match, trigger: $any($event.currentTarget) })">
            <span>PRÓXIMO PARTIDO ABIERTO · {{ match.level.toUpperCase() }}</span>
            <strong>{{ match.club }} · {{ match.day }} {{ match.time }}</strong>
            <small>{{ match.openSpots === 1 ? 'Falta 1 jugador' : 'Faltan ' + match.openSpots + ' jugadores' }} · Ver partido →</small>
          </button>
        </figcaption>
      }
    </figure>
  `,
})
export class PadelCourtArtComponent {
  /** Partido abierto que se ofrece en el cartel; si no hay ninguno, la cancha se muestra sola. */
  @Input() match: MatchPreview | null = null;
  @Output() open = new EventEmitter<{ match: MatchPreview; trigger: HTMLElement }>();
}
