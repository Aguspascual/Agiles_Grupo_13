import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicComplex } from '../complexes/complex.model';

@Component({
  selector: 'app-club-card',
  imports: [RouterLink],
  template: `
    <article class="club-card">
      <div class="club-card__body">
        <span class="club-card__zone">{{ club.zone }}</span>
        <h3>{{ club.name }}</h3>
        <p>{{ club.address }}</p>
      </div>
      <a
        [routerLink]="['/complejos', club.id, 'turnos']"
        [attr.aria-label]="'Ver turnos de ' + club.name"
      >Ver turnos <span aria-hidden="true">→</span></a>
    </article>
  `,
  styleUrl: './club-card.component.scss',
})
export class ClubCardComponent {
  @Input({ required: true }) club!: PublicComplex;
}
