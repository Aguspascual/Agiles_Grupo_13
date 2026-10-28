import { Injectable, signal } from '@angular/core';
import { MATCHES, PlayerPreview } from '../landing/landing.data';

const CURRENT_PLAYER: PlayerPreview = {
  initials: 'LM',
  name: 'Lucas M.',
  level: '5ta',
  tone: 'mint',
};

/** Participación local de HU-13 para demostrar la baja mientras no haya API. */
@Injectable({ providedIn: 'root' })
export class PendingMatchMembershipStore {
  private readonly initialMatch = MATCHES[0];
  readonly membership = signal({
    match: this.initialMatch,
    players: [...this.initialMatch.players, CURRENT_PLAYER],
    openSpots: 0,
    notice: '',
  });

  leave(): void {
    const current = this.membership();
    if (!current.players.some((player) => player.initials === CURRENT_PLAYER.initials)) return;
    const players = current.players.filter((player) => player.initials !== CURRENT_PLAYER.initials);
    this.membership.set({
      ...current,
      players,
      openSpots: Math.max(0, 4 - players.length),
      notice: 'Te bajaste del partido. Tu lugar volvió a estar disponible.',
    });
  }

  clearNotice(): void {
    this.membership.update((current) => ({ ...current, notice: '' }));
  }
}
