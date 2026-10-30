import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { PendingMatchInfo } from '../bookings/booking.model';
import { toDateKey } from '../shared/local-date';
import { DayGrid, GridCourt, GridSlot, SlotState } from './slot-grid.model';

/** Reloj inyectable para poder probar turnos pasados. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

export type DayGridResult =
  | { status: 'ok'; grid: DayGrid }
  | { status: 'not-found' }
  | { status: 'error' };

const SLOT_STATES: Record<string, SlotState> = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  BLOCKED: 'blocked',
  PENDING_MATCH: 'pending',
  CLASS: 'class',
};

/**
 * Grilla pública de turnos (HU-05): `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD`.
 * Ver `docs/contracts/hu-05-grilla-de-turnos.md`.
 */
@Injectable({ providedIn: 'root' })
export class SlotGridService {
  private readonly http = inject(HttpClient);

  dayGrid(complexId: string, date: Date): Observable<DayGridResult> {
    const dateKey = toDateKey(date);
    return this.http
      .get<unknown>(`/api/v1/complexes/${encodeURIComponent(complexId)}/slots`, {
        params: { date: dateKey },
      })
      .pipe(
        map((body): DayGridResult => ({ status: 'ok', grid: parseDayGrid(body, dateKey) })),
        catchError((error: unknown): Observable<DayGridResult> => {
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          return of(status === 404 || status === 400 ? { status: 'not-found' } : { status: 'error' });
        }),
      );
  }
}

function parseDayGrid(body: unknown, dateKey: string): DayGrid {
  if (!isRecord(body) || !isRecord(body['complex']) || !Array.isArray(body['courts'])) {
    throw new Error('Respuesta de turnos inválida');
  }
  const complex = body['complex'];
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
    date: dateKey,
    courts: body['courts'].map((court) => parseCourt(court, dateKey)),
  };
}

function parseCourt(value: unknown, dateKey: string): GridCourt {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['name'] !== 'string' ||
    typeof value['covered'] !== 'boolean' ||
    !Array.isArray(value['slots'])
  ) {
    throw new Error('Datos de cancha inválidos');
  }
  const courtId = value['id'];
  return {
    id: courtId,
    name: value['name'],
    covered: value['covered'],
    slots: value['slots'].map((slot) => parseSlot(slot, courtId, dateKey)),
  };
}

function parseSlot(value: unknown, courtId: string, date: string): GridSlot {
  if (
    !isRecord(value) ||
    ['id', 'startsAt', 'endsAt', 'status'].some((key) => typeof value[key] !== 'string') ||
    typeof value['isPast'] !== 'boolean'
  ) {
    throw new Error('Datos de turno inválidos');
  }
  const state = SLOT_STATES[value['status'] as string];
  if (!state) throw new Error('Estado de turno inválido');
  const slot: GridSlot = {
    id: value['id'] as string,
    courtId,
    date,
    startsAt: value['startsAt'] as string,
    endsAt: value['endsAt'] as string,
    state,
    isPast: value['isPast'],
  };
  if (state === 'pending') slot.pendingMatch = parsePendingMatch(value['pendingMatch']);
  return slot;
}

function parsePendingMatch(value: unknown): PendingMatchInfo {
  if (!isRecord(value) || typeof value['level'] !== 'string') {
    throw new Error('Partido abierto inválido');
  }
  const missing = value['missingPlayers'];
  if (missing !== 1 && missing !== 2 && missing !== 3) {
    throw new Error('Jugadores faltantes inválidos');
  }
  return { missingPlayers: missing, level: value['level'] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
