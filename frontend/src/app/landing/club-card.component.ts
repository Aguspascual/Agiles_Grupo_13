import { Component, Input } from '@angular/core';
import { ClubPreview } from './landing.data';

@Component({
  selector: 'app-club-card',
  template: `
    <article class="club-card">
      <img
        [src]="club.image"
        [alt]="'Cancha en ' + club.name"
        [style.object-position]="club.imagePosition"
        loading="lazy"
      />
      <div class="club-card__body">
        <div class="club-card__title">
          <h3>{{ club.name }}</h3>
          <span aria-label="Calificación {{ club.rating }} de 5">★ {{ club.rating }}</span>
        </div>
        <p>{{ club.zone }}</p>
        <small>{{ club.openSlots }} turnos disponibles hoy</small>
      </div>
      <a href="#partidos" [attr.aria-label]="'Ver turnos de ' + club.name">→</a>
    </article>
  `,
  styleUrl: './club-card.component.scss',
})
export class ClubCardComponent {
  @Input({ required: true }) club!: ClubPreview;
}
