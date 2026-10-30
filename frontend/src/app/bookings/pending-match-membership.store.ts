import { Injectable, signal } from '@angular/core';
import { MATCHES, MatchPreview, PlayerPreview } from '../landing/landing.data';

const CURRENT_PLAYER: PlayerPreview = {
  initials: 'LM',
  name: 'Lucas M.',
  level: '5ta',
  tone: 'mint',
};

const LEAVE_LIMIT_MS = 2 * 60 * 60 * 1000;

/** Convierte el día relativo ("Hoy"/"Mañana") y la hora ("20:30 hs") del partido en una fecha. */
function startsAtOf(match: MatchPreview, now: Date): Date {
  const [hours, minutes] = match.time.slice(0, 5).split(':').map(Number);
  const startsAt = new Date(now);
  if (match.day === 'Mañana') startsAt.setDate(startsAt.getDate() + 1);
  startsAt.setHours(hours, minutes, 0, 0);
  return startsAt;
}

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

  /** RN-03: se puede bajar si faltan al menos 2 horas, incluyendo el instante exacto del límite. */
  canLeave(now: Date = this.now()): boolean {
    return startsAtOf(this.membership().match, now).getTime() - now.getTime() >= LEAVE_LIMIT_MS;
  }

  /** Reloj reemplazable para pruebas determinísticas. */
  now: () => Date = () => new Date();

  leave(now: Date = this.now()): void {
    const current = this.membership();
    if (!this.canLeave(now)) return;
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
