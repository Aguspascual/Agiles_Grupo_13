import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

export type AgendaSlotStatus = 'AVAILABLE' | 'RESERVED' | 'BLOCKED';
export type ReservationOrigin = 'web' | 'manual';

export interface AgendaComplex {
  id: string;
  name: string;
  address: string;
  zone: string;
}

export interface AgendaSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AgendaSlotStatus;
  isPast: boolean;
  /** Solo en turnos `RESERVED`. */
  reservationId?: string;
}

export interface AgendaReservation {
  id: string;
  origin: ReservationOrigin;
  startsAt: string;
  endsAt: string;
  originalStartsAt: string;
  originalEndsAt: string;
  contact: { name: string; phone: string };
  /** Lo calcula el servidor: la reserva vigente todavía no terminó. */
  cancellable: boolean;
}

export interface AgendaCourt {
  id: string;
  name: string;
  covered: boolean;
  slots: AgendaSlot[];
  reservations: AgendaReservation[];
}

/**
 * Respuesta de `GET /api/v1/complexes/{complexId}/agenda?date=AAAA-MM-DD` (TDD-0015).
 * `pendingMatch` (partidos pendientes) todavía no existe: depende de HU-09/10/11.
 */
export interface Agenda {
  complex: AgendaComplex;
  date: string;
  courts: AgendaCourt[];
}

export interface ManualReservationInput {
  date: string;
  startsAt: string;
  contact: { name: string; phone: string };
}

/** Confirmación de una reserva creada o cancelada, sin datos de contacto. */
export interface ReservationReceipt {
  id: string;
  status: string;
}

const COMPLEX_API = (complexId: string) => `/api/v1/complexes/${encodeURIComponent(complexId)}`;
const SLOT_STATUSES = new Set<string>(['AVAILABLE', 'RESERVED', 'BLOCKED']);

/**
 * Agenda del complejo (HU-07), alta manual (HU-15) y cancelación por el encargado (HU-07/HU-14).
 * No guarda estado: cada pantalla decide cuándo volver a consultar.
 */
@Injectable({ providedIn: 'root' })
export class AgendaApiService {
  private readonly http = inject(HttpClient);

  load(complexId: string, date: string): Observable<Agenda> {
    return this.http
      .get<unknown>(`${COMPLEX_API(complexId)}/agenda`, { params: { date } })
      .pipe(map(parseAgenda));
  }

  registerManual(
    complexId: string,
    courtId: string,
    input: ManualReservationInput,
  ): Observable<ReservationReceipt> {
    const body: ManualReservationInput = {
      date: input.date,
      startsAt: input.startsAt,
      contact: { name: input.contact.name, phone: input.contact.phone },
    };
    return this.http
      .post<unknown>(
        `${COMPLEX_API(complexId)}/courts/${encodeURIComponent(courtId)}/manual-reservations`,
        body,
      )
      .pipe(map(parseReceipt));
  }

  cancel(complexId: string, reservationId: string): Observable<ReservationReceipt> {
    return this.http
      .post<unknown>(
        `${COMPLEX_API(complexId)}/reservations/${encodeURIComponent(reservationId)}/cancel`,
        null,
      )
      .pipe(map(parseReceipt));
  }
}

export function parseReceipt(value: unknown): ReservationReceipt {
  const reservation = isRecord(value) ? value['reservation'] : null;
  if (!isRecord(reservation) || typeof reservation['id'] !== 'string' || typeof reservation['status'] !== 'string') {
    throw new Error('Respuesta de reserva inválida');
  }
  return { id: reservation['id'], status: reservation['status'] };
}

function parseAgenda(value: unknown): Agenda {
  if (!isRecord(value) || !isRecord(value['complex']) || typeof value['date'] !== 'string' || !Array.isArray(value['courts'])) {
    throw new Error('Respuesta de agenda inválida');
  }
  const complex = value['complex'];
  if (['id', 'name', 'address', 'zone'].some((key) => typeof complex[key] !== 'string')) {
    throw new Error('Datos de complejo inválidos');
  }
  return {
    complex: {
      id: complex['id'] as string,
      name: complex['name'] as string,
      address: complex['address'] as string,
      zone: complex['zone'] as string,
    },
    date: value['date'],
    courts: value['courts'].map(parseCourt),
  };
}

function parseCourt(value: unknown): AgendaCourt {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['name'] !== 'string' ||
    typeof value['covered'] !== 'boolean' ||
    !Array.isArray(value['slots'])
  ) {
    throw new Error('Datos de cancha inválidos');
  }
  return {
    id: value['id'],
    name: value['name'],
    covered: value['covered'],
    slots: value['slots'].map(parseSlot),
    reservations: Array.isArray(value['reservations']) ? value['reservations'].map(parseReservation) : [],
  };
}

function parseSlot(value: unknown): AgendaSlot {
  if (
    !isRecord(value) ||
    ['id', 'startsAt', 'endsAt', 'status'].some((key) => typeof value[key] !== 'string') ||
    !SLOT_STATUSES.has(value['status'] as string) ||
    typeof value['isPast'] !== 'boolean'
  ) {
    throw new Error('Datos de turno inválidos');
  }
  const slot: AgendaSlot = {
    id: value['id'] as string,
    startsAt: value['startsAt'] as string,
    endsAt: value['endsAt'] as string,
    status: value['status'] as AgendaSlotStatus,
    isPast: value['isPast'],
  };
  if (typeof value['reservationId'] === 'string') slot.reservationId = value['reservationId'];
  return slot;
}

function parseReservation(value: unknown): AgendaReservation {
  if (
    !isRecord(value) ||
    ['id', 'startsAt', 'endsAt', 'originalStartsAt', 'originalEndsAt'].some((key) => typeof value[key] !== 'string') ||
    (value['origin'] !== 'web' && value['origin'] !== 'manual') ||
    !isRecord(value['contact']) ||
    typeof value['contact']['name'] !== 'string' ||
    typeof value['contact']['phone'] !== 'string' ||
    typeof value['cancellable'] !== 'boolean'
  ) {
    throw new Error('Datos de reserva inválidos');
  }
  return {
    id: value['id'] as string,
    origin: value['origin'],
    startsAt: value['startsAt'] as string,
    endsAt: value['endsAt'] as string,
    originalStartsAt: value['originalStartsAt'] as string,
    originalEndsAt: value['originalEndsAt'] as string,
    contact: { name: value['contact']['name'], phone: value['contact']['phone'] },
    cancellable: value['cancellable'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
