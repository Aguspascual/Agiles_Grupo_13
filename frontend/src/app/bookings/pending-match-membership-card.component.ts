import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { PendingMatchMembershipStore } from './pending-match-membership.store';

@Component({
  selector: 'app-pending-match-membership-card',
  template: `
    <article class="membership-card" aria-labelledby="membership-title">
      <div class="membership-card__top">
        <span class="membership-card__eyebrow">TU PARTIDO PENDIENTE · DEMO</span>
        <span class="membership-card__occupancy">{{ store.membership().players.length }}/4</span>
      </div>
      <div class="membership-card__body">
        <div>
          <h2 id="membership-title">{{ store.membership().match.club }}</h2>
          <p>{{ store.membership().match.day }} · {{ store.membership().match.time }} · {{ store.membership().match.zone }}</p>
        </div>
        <div class="membership-card__players" aria-label="Jugadores anotados">
          @for (player of store.membership().players; track player.initials) {
            <span class="membership-card__player" [class.is-current]="player.initials === 'LM'">
              <b>{{ player.initials }}</b><span>{{ player.name }}</span>
            </span>
          }
          @for (_ of emptyPlaces(); track $index) {
            <span class="membership-card__player is-open"><b>+</b><span>Lugar libre</span></span>
          }
        </div>
      </div>
      @if (store.membership().openSpots > 0) {
        <p class="membership-card__vacancy">Falta {{ store.membership().openSpots }} jugador · Nivel {{ store.membership().match.level }}</p>
      }
      <footer>
        <span>{{ store.membership().openSpots > 0 ? 'Partido pendiente' : 'Turno completo' }}</span>
        @if (store.membership().players.some(isCurrentPlayer)) {
          <button type="button" (click)="confirmationOpen.set(true)">Bajarme del partido</button>
        } @else {
          <span class="membership-card__left">Ya no estás anotado</span>
        }
      </footer>
    </article>
    @if (confirmationOpen()) {
      <div class="membership-backdrop" (click)="confirmationOpen.set(false)">
        <section class="membership-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" (click)="$event.stopPropagation()">
          <span class="membership-dialog__icon" aria-hidden="true">!</span>
          <h2 id="leave-title">¿Querés bajarte del partido?</h2>
          <p>Tu lugar quedará libre para que otro jugador se sume.</p>
          <div>
            <button type="button" class="membership-dialog__cancel" (click)="confirmationOpen.set(false)">Seguir anotado</button>
            <button type="button" class="membership-dialog__confirm" (click)="confirmLeave()">Sí, bajarme</button>
          </div>
        </section>
      </div>
    }
    @if (store.membership().notice; as notice) {
      <p class="membership-toast" role="status">{{ notice }} <button type="button" aria-label="Cerrar aviso" (click)="store.clearNotice()">×</button></p>
    }
  `,
  styleUrl: './pending-match-membership-card.component.scss',
})
export class PendingMatchMembershipCardComponent implements OnDestroy {
  readonly store = inject(PendingMatchMembershipStore);
  readonly confirmationOpen = signal(false);
  readonly isCurrentPlayer = (player: { initials: string }) => player.initials === 'LM';
  private noticeTimer?: ReturnType<typeof setTimeout>;
  readonly emptyPlaces = computed(() =>
    Array.from({ length: this.store.membership().openSpots }, (_, index) => index),
  );

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.confirmationOpen.set(false);
  }

  confirmLeave(): void {
    this.store.leave();
    this.confirmationOpen.set(false);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.store.clearNotice(), 3500);
  }

  ngOnDestroy(): void {
    clearTimeout(this.noticeTimer);
  }
}
