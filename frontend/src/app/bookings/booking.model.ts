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
  /** Datos de una reserva completa creada localmente por HU-06. */
  reservation?: ReservationGroup;
  /** Solo en partidos pendientes. */
  pendingMatch?: PendingMatchInfo;
}

export interface ReservationGroup {
  responsibleName: string;
  contactPhone: string;
  players: [string, string, string, string];
  preferences?: {
    category: string;
    gender: string;
  };
}

export interface PendingMatchInfo {
  missingPlayers: 1 | 2 | 3;
  level: string;
}
