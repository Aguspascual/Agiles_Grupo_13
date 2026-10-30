import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MatchPreview } from '../landing/landing.data';
import {
  parseAvailability,
  parseComplexList,
  parseMatchEnvelope,
  parseMatchList,
  parseNoticeList,
  toMatchPreview,
} from './match-api.mapper';
import { AvailabilityOption, ComplexOption, MatchCreateRequest, MatchNotice } from './match-api.model';

const MATCHES_API = '/api/v1/matches';

@Injectable({ providedIn: 'root' })
export class MatchApiService {
  private readonly http = inject(HttpClient);

  list(filters: { date?: string; complexId?: string; level?: string } = {}): Observable<MatchPreview[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value);
    return this.http.get<unknown>(MATCHES_API, { params }).pipe(map(parseMatchList));
  }

  createOpen(complexId: string, courtId: string, request: MatchCreateRequest): Observable<MatchPreview> {
    const url = `/api/v1/complexes/${encodeURIComponent(complexId)}/courts/${encodeURIComponent(courtId)}/matches`;
    return this.http.post<unknown>(url, request).pipe(map(parseMatchEnvelope));
  }

  join(matchId: string): Observable<MatchPreview> {
    return this.http.post<unknown>(`${MATCHES_API}/${encodeURIComponent(matchId)}/players`, null)
      .pipe(map(parseMatchEnvelope));
  }

  complexes(): Observable<ComplexOption[]> {
    return this.http.get<unknown>('/api/v1/public/complexes').pipe(map(parseComplexList));
  }

  availability(complexId: string, date: string): Observable<Map<string, AvailabilityOption[]>> {
    const url = `/api/v1/complexes/${encodeURIComponent(complexId)}/slots`;
    return this.http.get<unknown>(url, { params: { date } }).pipe(map(parseAvailability));
  }

  unreadNotices(): Observable<MatchNotice[]> {
    return this.http.get<unknown>('/api/v1/match-notices').pipe(map(parseNoticeList));
  }

  markNoticeRead(id: string): Observable<void> {
    return this.http.post<void>(`/api/v1/match-notices/${encodeURIComponent(id)}/read`, null);
  }
}
