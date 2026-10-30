import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { parseReceipt, ReservationReceipt } from '../agenda/agenda-api.service';

export type MyReservationView = 'upcoming' | 'past';
export type MyReservationKind = 'reservation' | 'match';
export type MyReservationStatus = 'reserved' | 'cancelled';
export type MyReservationRole = 'organizer' | 'player';
export type MyMatchStatus = 'open' | 'full';

export interface MyMatchInfo {
  status: MyMatchStatus;
  targetLevel: string;
  missingPlayers: number;
}

export interface MyReservationItem {
  kind: MyReservationKind;
  /** Id de la reserva (`reservation`) o del partido (`match`). */
  id: string;
  reservationId: string;
  status: MyReservationStatus;
  complex: { id: string; name: string };
  court: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  timeZone: string;
  role: MyReservationRole;
  cancellable: boolean;
  /** Solo en `kind=match`. */
  match?: MyMatchInfo;
}

export interface MyReservationsPage {
  items: MyReservationItem[];
  page: { limit: number; offset: number; hasMore: boolean };
}

const KINDS = new Set<string>(['reservation', 'match']);
const STATUSES = new Set<string>(['reserved', 'cancelled']);
const ROLES = new Set<string>(['organizer', 'player']);
const MATCH_STATUSES = new Set<string>(['open', 'full']);

/**
 * Reservas y partidos del jugador (HU-17, TDD-0013 v2) y cancelación de una reserva propia (HU-14, TDD-0010).
 * `cancelOwn`: `POST /api/v1/reservations/{id}/cancel`; 404 si no es la reserva del jugador y 409 si faltan menos de 4 horas.
 */
@Injectable({ providedIn: 'root' })
export class ReservationApiService {
  private readonly http = inject(HttpClient);

  listMine(view: MyReservationView, limit: number, offset: number): Observable<MyReservationsPage> {
    const params = new HttpParams().set('view', view).set('limit', String(limit)).set('offset', String(offset));
    return this.http.get<unknown>('/api/v1/me/reservations', { params }).pipe(map(parseMyReservations));
  }

  cancelOwn(reservationId: string): Observable<ReservationReceipt> {
    return this.http
      .post<unknown>(`/api/v1/reservations/${encodeURIComponent(reservationId)}/cancel`, null)
      .pipe(map(parseReceipt));
  }
}

export function parseMyReservations(value: unknown): MyReservationsPage {
  if (!isRecord(value) || !Array.isArray(value['items']) || !isRecord(value['page'])) {
    throw new Error('Respuesta de reservas inválida');
  }
  const page = value['page'];
  if (typeof page['limit'] !== 'number' || typeof page['offset'] !== 'number' || typeof page['hasMore'] !== 'boolean') {
    throw new Error('Paginación inválida');
  }
  return {
    items: value['items'].map(parseItem),
    page: { limit: page['limit'], offset: page['offset'], hasMore: page['hasMore'] },
  };
}

function parseItem(value: unknown): MyReservationItem {
  if (
    !isRecord(value) ||
    ['id', 'reservationId', 'startsAt', 'endsAt', 'timeZone'].some((key) => typeof value[key] !== 'string') ||
    !KINDS.has(value['kind'] as string) ||
    !STATUSES.has(value['status'] as string) ||
    !ROLES.has(value['role'] as string) ||
    typeof value['cancellable'] !== 'boolean'
  ) {
    throw new Error('Datos de reserva inválidos');
  }
  const kind = value['kind'] as MyReservationKind;
  const item: MyReservationItem = {
    kind,
    id: value['id'] as string,
    reservationId: value['reservationId'] as string,
    status: value['status'] as MyReservationStatus,
    complex: parseNamed(value['complex']),
    court: parseNamed(value['court']),
    startsAt: value['startsAt'] as string,
    endsAt: value['endsAt'] as string,
    timeZone: value['timeZone'] as string,
    role: value['role'] as MyReservationRole,
    cancellable: value['cancellable'],
  };
  if (kind === 'match') {
    item.match = parseMatch(value['match']);
  } else if (value['match'] !== undefined && value['match'] !== null) {
    throw new Error('Una reserva no puede traer datos de partido');
  }
  return item;
}

function parseMatch(value: unknown): MyMatchInfo {
  if (
    !isRecord(value) ||
    !MATCH_STATUSES.has(value['status'] as string) ||
    typeof value['targetLevel'] !== 'string' ||
    typeof value['missingPlayers'] !== 'number'
  ) {
    throw new Error('Datos de partido inválidos');
  }
  return {
    status: value['status'] as MyMatchStatus,
    targetLevel: value['targetLevel'],
    missingPlayers: value['missingPlayers'],
  };
}

function parseNamed(value: unknown): { id: string; name: string } {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string') {
    throw new Error('Datos de recurso inválidos');
  }
  return { id: value['id'], name: value['name'] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}