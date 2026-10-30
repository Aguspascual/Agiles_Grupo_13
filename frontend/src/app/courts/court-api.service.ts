import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { COURT_FEATURES, CourtDraft, CourtFeatureId, CourtRecord } from './court.model';

const COURT_API = (complexId: string) => `/api/v1/complexes/${encodeURIComponent(complexId)}/courts`;
const FEATURE_IDS = new Set<string>(COURT_FEATURES.map((feature) => feature.id));

@Injectable({ providedIn: 'root' })
export class CourtApiService {
  private readonly http = inject(HttpClient);

  /** Canchas del último complejo cargado. */
  readonly courts = signal<CourtRecord[]>([]);

  load(complexId: string): Observable<CourtRecord[]> {
    return this.http.get<unknown>(COURT_API(complexId)).pipe(
      map(parseCourtList),
      tap((courts) => this.courts.set(courts)),
    );
  }

  create(complexId: string, draft: CourtDraft): Observable<CourtRecord> {
    return this.http.post<unknown>(COURT_API(complexId), toBody(draft)).pipe(
      map(parseCourtEnvelope),
      tap((court) => this.courts.update((courts) => [...courts, court])),
    );
  }

  update(complexId: string, id: string, draft: CourtDraft): Observable<CourtRecord> {
    return this.http.put<unknown>(`${COURT_API(complexId)}/${encodeURIComponent(id)}`, toBody(draft)).pipe(
      map(parseCourtEnvelope),
      tap((court) => this.courts.update((courts) => courts.map((item) => (item.id === court.id ? court : item)))),
    );
  }

  remove(complexId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${COURT_API(complexId)}/${encodeURIComponent(id)}`).pipe(
      tap(() => this.courts.update((courts) => courts.filter((court) => court.id !== id))),
    );
  }
}

function toBody(draft: CourtDraft): CourtDraft {
  return {
    name: draft.name,
    covered: draft.covered,
    imageDataUrl: draft.imageDataUrl,
    features: draft.features,
  };
}

function parseCourtList(value: unknown): CourtRecord[] {
  if (!isRecord(value) || !Array.isArray(value['courts'])) throw new Error('Respuesta de canchas inválida');
  return value['courts'].map(parseCourt);
}

function parseCourtEnvelope(value: unknown): CourtRecord {
  if (!isRecord(value)) throw new Error('Respuesta de cancha inválida');
  return parseCourt(value['court']);
}

function parseCourt(value: unknown): CourtRecord {
  if (
    !isRecord(value) ||
    ['id', 'complexId', 'name'].some((key) => typeof value[key] !== 'string') ||
    typeof value['covered'] !== 'boolean'
  ) {
    throw new Error('Datos de cancha inválidos');
  }
  const features = Array.isArray(value['features'])
    ? value['features'].filter((id): id is CourtFeatureId => typeof id === 'string' && FEATURE_IDS.has(id))
    : [];
  return {
    id: value['id'] as string,
    complexId: value['complexId'] as string,
    name: value['name'] as string,
    covered: value['covered'] as boolean,
    imageDataUrl: typeof value['imageDataUrl'] === 'string' ? value['imageDataUrl'] : null,
    features,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
