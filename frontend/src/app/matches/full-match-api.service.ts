import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface FullMatchInvitationInput {
  name: string;
  email: string;
  userId?: string;
}

export interface FullMatchInviteeSuggestion {
  id: string;
  name: string;
  emailHint: string;
}

export interface FullMatchInvitation {
  id: string;
  name: string;
  email?: string;
  status: 'pending' | 'accepted' | 'expired';
  token?: string;
}

export interface FullMatch {
  id: string;
  status: 'pending' | 'full' | 'cancelled' | 'expired';
  complex: string;
  court: string;
  date: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  invitations: FullMatchInvitation[];
}

@Injectable({ providedIn: 'root' })
export class FullMatchApiService {
  private readonly http = inject(HttpClient);

  searchPlayers(query: string): Observable<FullMatchInviteeSuggestion[]> {
    return this.http.get<unknown>('/api/v1/players/search', { params: { q: query } })
      .pipe(map((value) => parseInviteeSearchEnvelope(value)));
  }

  create(complexId: string, courtId: string, request: {
    date: string;
    startsAt: string;
    phone: string;
    invites: FullMatchInvitationInput[];
  }): Observable<FullMatch> {
    const path = `/api/v1/complexes/${encodeURIComponent(complexId)}/courts/${encodeURIComponent(courtId)}/full-matches`;
    return this.http.post<unknown>(path, request).pipe(map((value) => parseMatchEnvelope(value)));
  }

  invitation(token: string): Observable<FullMatch> {
    return this.http.get<unknown>(`/api/v1/full-match-invitations/${encodeURIComponent(token)}`)
      .pipe(map((value) => parseMatchEnvelope(value)));
  }

  get(matchId: string): Observable<FullMatch> {
    return this.http.get<unknown>(`/api/v1/full-matches/${encodeURIComponent(matchId)}`)
      .pipe(map((value) => parseMatchEnvelope(value)));
  }

  accept(token: string): Observable<FullMatch> {
    return this.http.post<unknown>(`/api/v1/full-match-invitations/${encodeURIComponent(token)}/accept`, null)
      .pipe(map((value) => parseMatchEnvelope(value)));
  }
}

function parseInviteeSearchEnvelope(value: unknown): FullMatchInviteeSuggestion[] {
  if (!isRecord(value) || !Array.isArray(value['players'])) throw new Error('Respuesta inválida de búsqueda de jugadores');
  return value['players'].map((player): FullMatchInviteeSuggestion => {
    if (!isRecord(player) || typeof player['id'] !== 'string' || typeof player['name'] !== 'string'
      || typeof player['emailHint'] !== 'string') throw new Error('Jugador inválido en la búsqueda');
    return { id: player['id'], name: player['name'], emailHint: player['emailHint'] };
  });
}

function parseMatchEnvelope(value: unknown): FullMatch {
  if (!isRecord(value) || !isRecord(value['match'])) throw new Error('Respuesta inválida de partido privado');
  const match = value['match'];
  const fields = ['id', 'status', 'complex', 'court', 'date', 'startsAt', 'endsAt', 'expiresAt'];
  if (fields.some((field) => typeof match[field] !== 'string') || !Array.isArray(match['invitations'])) {
    throw new Error('Respuesta incompleta de partido privado');
  }
  const invitations = match['invitations'].map(parseInvitation);
  return {
    id: match['id'] as string,
    status: match['status'] as FullMatch['status'],
    complex: match['complex'] as string,
    court: match['court'] as string,
    date: match['date'] as string,
    startsAt: match['startsAt'] as string,
    endsAt: match['endsAt'] as string,
    expiresAt: match['expiresAt'] as string,
    invitations,
  };
}

function parseInvitation(value: unknown): FullMatchInvitation {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string'
    || !['pending', 'accepted', 'expired'].includes(String(value['status']))) {
    throw new Error('Respuesta inválida de invitación');
  }
  return {
    id: value['id'],
    name: value['name'],
    email: typeof value['email'] === 'string' ? value['email'] : undefined,
    status: value['status'] as FullMatchInvitation['status'],
    token: typeof value['token'] === 'string' ? value['token'] : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
