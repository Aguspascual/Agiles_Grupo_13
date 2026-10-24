import { PendingMatchInfo } from '../bookings/booking.model';

/**
 * `pending` es un partido abierto que busca jugadores; `class`, un turno que el complejo reservó
 * para una clase; `blocked`, un turno que el complejo cerró desde la configuración de horarios.
 */
export type SlotState = 'available' | 'pending' | 'reserved' | 'class' | 'blocked';

export const SLOT_STATE_LABELS: Record<SlotState, string> = {
  available: 'Libre',
  pending: 'Partido abierto',
  reserved: 'Reservado',
  class: 'Clase',
  blocked: 'No disponible',
};

/** Estados que explica la leyenda. `blocked` se ve igual que un turno reservado. */
export const LEGEND_STATES: SlotState[] = ['available', 'pending', 'reserved', 'class'];

export interface GridSlot {
  id: string;
  courtId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  state: SlotState;
  /** El turno ya empezó: se muestra atenuado y no se puede reservar. */
  isPast: boolean;
  pendingMatch?: PendingMatchInfo;
}

export interface GridCourt {
  id: string;
  name: string;
  covered: boolean;
  slots: GridSlot[];
}

export interface GridComplex {
  id: string;
  name: string;
  address: string;
  zone: string;
}

/** Respuesta equivalente a `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD`. */
export interface DayGrid {
  complex: GridComplex;
  date: string;
  courts: GridCourt[];
}

export function isSelectable(slot: GridSlot): boolean {
  return !slot.isPast && (slot.state === 'available' || slot.state === 'pending');
}

export function describeSlot(slot: GridSlot, courtName: string): string {
  const parts = [courtName, `${slot.startsAt} a ${slot.endsAt}`, SLOT_STATE_LABELS[slot.state]];
  if (slot.state === 'pending' && slot.pendingMatch) {
    parts.push(
      missingPlayersLabel(slot.pendingMatch.missingPlayers),
      `nivel ${slot.pendingMatch.level}`,
    );
  }
  if (slot.isPast) parts.push('turno pasado');
  return parts.join(', ');
}

export function missingPlayersLabel(missing: number): string {
  return missing === 1 ? 'Falta 1 jugador' : `Faltan ${missing} jugadores`;
}
