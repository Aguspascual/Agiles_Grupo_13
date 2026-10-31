import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicComplex } from '../complexes/complex.model';

@Component({
  selector: 'app-club-card',
  imports: [RouterLink],
  template: `
    <article class="club-card">
      <div class="club-card__media">
        @if (club.imageUrl) {
          <img [src]="club.imageUrl" [alt]="'Imagen de ' + club.name" loading="lazy" />
        } @else {
          <span class="club-card__placeholder" aria-hidden="true">⌂</span>
        }
        <span class="club-card__zone">{{ club.zone }}</span>
      </div>
      <div class="club-card__body">
        <h3>{{ club.name }}</h3>
        <p>{{ club.address }}</p>
        @if (courtCount !== null) {
          <p class="club-card__courts">{{ courtCount }} {{ courtCount === 1 ? 'cancha' : 'canchas' }}</p>
        }
      </div>
      <a
        [routerLink]="['/clubes', club.id, 'turnos']"
        [attr.aria-label]="'Ver turnos de ' + club.name"
      >Ver turnos <span aria-hidden="true">→</span></a>
    </article>
  `,
  styleUrl: './club-card.component.scss',
})
export class ClubCardComponent {
  @Input({ required: true }) club!: PublicComplex;
  /** Cantidad de canchas publicadas del complejo; si no se conoce, no se muestra. */
  @Input() courtCount: number | null = null;
}