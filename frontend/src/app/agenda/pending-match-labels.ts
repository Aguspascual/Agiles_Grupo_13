import { PendingMatch } from './agenda-api.service';

export const MATCH_SIZE = 4;

/** "Faltan 2", "Falta 1" o "Completo". */
export function missingLabel(match: PendingMatch): string {
  if (match.missingPlayers <= 0) return 'Completo';
  return match.missingPlayers === 1 ? 'Falta 1' : `Faltan ${match.missingPlayers}`;
}

/** "Anotados (1 de 4)". */
export function signedUpLabel(match: PendingMatch): string {
  return `Anotados (${match.players.length} de ${MATCH_SIZE})`;
}

/** "1 jugador anotado" o "3 jugadores anotados". */
export function signedUpCountLabel(match: PendingMatch): string {
  const count = match.players.length;
  return count === 1 ? '1 jugador anotado' : `${count} jugadores anotados`;
}

/** Nombres separados por coma, para resúmenes compactos. */
export function playerNames(match: PendingMatch): string {
  return match.players.map((player) => player.name).join(', ');
}

/** Aviso del diálogo de cancelación: no promete avisos a los anotados. */
export function cancelOpenMatchNotice(match: PendingMatch | undefined): string {
  if (!match) return 'El partido abierto se cancelará.';
  return `El partido tiene ${signedUpCountLabel(match)}. Se cancelará y se liberará el turno; por ahora no se les avisa.`;
}
