/**
 * `full`: reserva con los cuatro jugadores. `pending`: reserva buscando jugadores (partido abierto).
 * `class`: turno reservado por el complejo para dar una clase.
 */
export type BookingKind = 'full' | 'pending' | 'class';

export interface BookingRecord {
  id: string;
  /** Mismo identificador que el turno generado: `courtId:AAAA-MM-DD:HH:MM`. */
  slotId: string;
  courtId: string;
  date: string;
  startsAt: string;
  kind: BookingKind;
  holderName: string;
  holderPhone: string;
  /** Solo en partidos pendientes. */
  pendingMatch?: PendingMatchInfo;
}

export interface PendingMatchInfo {
  missingPlayers: 1 | 2 | 3;
  level: string;
}

/** Reemplazo solo habilitado durante las últimas cuatro horas previas al inicio. */
export function isPendingReplacementWindowOpen(startsAt: Date, now: Date): boolean {
  const remainingMs = startsAt.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs < 4 * 60 * 60 * 1000;
}
