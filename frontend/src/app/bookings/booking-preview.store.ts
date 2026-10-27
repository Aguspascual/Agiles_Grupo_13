import { Injectable, signal } from '@angular/core';
import { BookingRecord, PendingMatchInfo, ReservationGroup } from './booking.model';

/** Datos mínimos de un turno para buscar su reserva. */
export interface SlotRef {
  id: string;
  courtId: string;
  date: string;
  startsAt: string;
}

export type ReservationResult =
  | { status: 'created'; booking: BookingRecord }
  | { status: 'conflict' };

const DEMO_LEVELS = ['8va', '7ma', '6ta', '5ta', '4ta', '3ra'];
const DEMO_HOLDERS = [
  { name: 'Juan Pérez', phone: '221 555-0101' },
  { name: 'Lucía Romero', phone: '221 555-0102' },
  { name: 'Martín Vega', phone: '221 555-0103' },
  { name: 'Sofía Luna', phone: '221 555-0104' },
  { name: 'Nicolás Paz', phone: '221 555-0105' },
  { name: 'Belén Ortiz', phone: '221 555-0106' },
];
const DEMO_COACHES = [
  { name: 'Prof. Ana Ruiz', phone: '221 555-0201' },
  { name: 'Prof. Diego Sosa', phone: '221 555-0202' },
  { name: 'Prof. Carla Medina', phone: '221 555-0203' },
];

/**
 * Reservas de demostración mientras no exista la API de reservas.
 *
 * La ocupación de ejemplo se calcula de forma determinística a partir del identificador del turno:
 * el mismo turno muestra siempre el mismo estado en cualquier pantalla (grilla del jugador y,
 * más adelante, agenda del complejo). Las reservas creadas en la sesión tienen prioridad.
 */
@Injectable({ providedIn: 'root' })
export class BookingPreviewStore {
  /** Reservas creadas en esta sesión (se completa en HU-06). */
  protected readonly created = signal<BookingRecord[]>([]);

  bookingFor(slot: SlotRef): BookingRecord | null {
    return this.created().find((booking) => booking.slotId === slot.id) ?? demoBookingFor(slot);
  }

  reserve(slot: SlotRef, group: ReservationGroup): ReservationResult {
    if (this.bookingFor(slot)) return { status: 'conflict' };

    const booking: BookingRecord = {
      id: `local:${slot.id}`,
      slotId: slot.id,
      courtId: slot.courtId,
      date: slot.date,
      startsAt: slot.startsAt,
      kind: 'full',
      holderName: group.responsibleName,
      holderPhone: group.contactPhone,
      reservation: {
        ...group,
        players: [group.players[0], group.players[1], group.players[2], group.players[3]],
        preferences: group.preferences ? { ...group.preferences } : undefined,
      },
    };
    this.created.update((bookings) => [...bookings, booking]);
    return { status: 'created', booking };
  }

  reserveOpen(slot: SlotRef, holderName: string, level: string): ReservationResult {
    if (this.bookingFor(slot)) return { status: 'conflict' };

    const booking: BookingRecord = {
      id: `local:${slot.id}`,
      slotId: slot.id,
      courtId: slot.courtId,
      date: slot.date,
      startsAt: slot.startsAt,
      kind: 'pending',
      holderName,
      holderPhone: '',
      pendingMatch: { missingPlayers: 3, level },
    };
    this.created.update((bookings) => [...bookings, booking]);
    return { status: 'created', booking };
  }
}

export function demoBookingFor(slot: SlotRef): BookingRecord | null {
  const hash = hashText(slot.id);
  const roll = hash % 100;
  // A la noche hay más reservas y partidos; durante el día, más clases.
  const evening = slot.startsAt >= '18:00';
  const reservedLimit = evening ? 42 : 12;
  const pendingLimit = reservedLimit + (evening ? 16 : 8);
  const classLimit = pendingLimit + (evening ? 4 : 16);
  if (roll >= classLimit) return null;

  const isClass = roll >= pendingLimit;
  const holder = (isClass ? DEMO_COACHES : DEMO_HOLDERS)[hash % (isClass ? 3 : 6)];
  const base = {
    id: `demo:${slot.id}`,
    slotId: slot.id,
    courtId: slot.courtId,
    date: slot.date,
    startsAt: slot.startsAt,
    holderName: holder.name,
    holderPhone: holder.phone,
  };
  if (isClass) return { ...base, kind: 'class' };
  if (roll < reservedLimit) return { ...base, kind: 'full' };

  const pendingMatch: PendingMatchInfo = {
    missingPlayers: (((hash >>> 3) % 3) + 1) as PendingMatchInfo['missingPlayers'],
    level: DEMO_LEVELS[(hash >>> 5) % DEMO_LEVELS.length],
  };
  return { ...base, kind: 'pending', pendingMatch };
}

/** FNV-1a de 32 bits: estable y suficiente para repartir estados de ejemplo. */
function hashText(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
