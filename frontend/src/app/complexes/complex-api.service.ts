import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ComplexDraft, ComplexRecord, ManagerOption, PublicComplex, PublicCourt } from './complex.model';

const COMPLEXES_API = '/api/v1/complexes';
const PUBLIC_COMPLEXES_API = '/api/v1/public/complexes';
const PUBLIC_COURTS_API = '/api/v1/public/courts';

@Injectable({ providedIn: 'root' })
export class ComplexApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<ComplexRecord[]> {
    return this.http.get<unknown>(COMPLEXES_API).pipe(map(parseComplexList));
  }

  /** Listado público (sin sesión) para el directorio de clubes. */
  listPublic(): Observable<PublicComplex[]> {
    return this.http.get<unknown>(PUBLIC_COMPLEXES_API).pipe(map(parsePublicComplexList));
  }

  /** Canchas de todos los complejos publicados, con su imagen y características (sin sesión). */
  listPublicCourts(): Observable<PublicCourt[]> {
    return this.http.get<unknown>(PUBLIC_COURTS_API).pipe(map(parsePublicCourtList));
  }

  availableManagers(): Observable<ManagerOption[]> {
    return this.http.get<unknown>(`${COMPLEXES_API}/available-managers`).pipe(map(parseManagerList));
  }

  create(draft: ComplexDraft): Observable<ComplexRecord> {
    return this.http.post<unknown>(COMPLEXES_API, draft).pipe(map(value => parseComplexEnvelope(value)));
  }

  update(id: string, draft: ComplexDraft): Observable<ComplexRecord> {
    return this.http.put<unknown>(`${COMPLEXES_API}/${encodeURIComponent(id)}`, draft).pipe(map(parseComplexEnvelope));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${COMPLEXES_API}/${encodeURIComponent(id)}`);
  }
}

function parseComplexList(value: unknown): ComplexRecord[] {
  if (!isRecord(value) || !Array.isArray(value['complexes'])) throw new Error('Respuesta de complejos inválida');
  return value['complexes'].map(parseComplex);
}

function parsePublicComplexList(value: unknown): PublicComplex[] {
  if (!isRecord(value) || !Array.isArray(value['complexes'])) throw new Error('Respuesta de complejos inválida');
  return value['complexes'].map((item) => {
    if (!isRecord(item) || ['id', 'name', 'address', 'zone'].some(key => typeof item[key] !== 'string')) {
      throw new Error('Datos de complejo inválidos');
    }
    return {
      id: item['id'] as string,
      name: item['name'] as string,
      address: item['address'] as string,
      zone: item['zone'] as string,
      ...(typeof item['imageUrl'] === 'string' && item['imageUrl'] ? { imageUrl: item['imageUrl'] } : {}),
    };
  });
}

function parsePublicCourtList(value: unknown): PublicCourt[] {
  if (!isRecord(value) || !Array.isArray(value['courts'])) throw new Error('Respuesta de canchas inválida');
  return value['courts'].map((item) => {
    if (!isRecord(item) || ['id', 'name', 'complexId', 'complexName', 'complexZone', 'complexAddress'].some((key) => typeof item[key] !== 'string') || typeof item['covered'] !== 'boolean') {
      throw new Error('Datos de cancha inválidos');
    }
    return {
      id: item['id'] as string,
      name: item['name'] as string,
      covered: item['covered'] as boolean,
      features: Array.isArray(item['features']) ? item['features'].filter((feature): feature is string => typeof feature === 'string') : [],
      ...(typeof item['imageUrl'] === 'string' && item['imageUrl'] ? { imageUrl: item['imageUrl'] } : {}),
      complexId: item['complexId'] as string,
      complexName: item['complexName'] as string,
      complexZone: item['complexZone'] as string,
      complexAddress: item['complexAddress'] as string,
    };
  });
}

function parseComplexEnvelope(value: unknown): ComplexRecord {
  if (!isRecord(value)) throw new Error('Respuesta de complejo inválida');
  return parseComplex(value['complex']);
}

function parseComplex(value: unknown): ComplexRecord {
  if (!isRecord(value)) throw new Error('Datos de complejo inválidos');
  const managers = Array.isArray(value['managers']) ? value['managers'].map(parseManager) : [];
  const managerIds = Array.isArray(value['managerIds'])
    ? value['managerIds'].filter((id): id is string => typeof id === 'string')
    : managers.map(manager => manager.id);
  if (['id', 'name', 'address', 'zone', 'phone'].some(key => typeof value[key] !== 'string')) {
    throw new Error('Datos de complejo inválidos');
  }
  return {
    id: value['id'] as string,
    name: value['name'] as string,
    address: value['address'] as string,
    zone: value['zone'] as string,
    phone: value['phone'] as string,
    imageDataUrl: typeof value['imageDataUrl'] === 'string' ? value['imageDataUrl'] : null,
    managerIds,
    managers,
  };
}

function parseManagerList(value: unknown): ManagerOption[] {
  if (!isRecord(value) || !Array.isArray(value['managers'])) throw new Error('Respuesta de encargados inválida');
  return value['managers'].map(parseManager);
}

function parseManager(value: unknown): ManagerOption {
  if (!isRecord(value) || ['id', 'name', 'email'].some(key => typeof value[key] !== 'string')) {
    throw new Error('Datos de encargado inválidos');
  }
  return { id: value['id'] as string, name: value['name'] as string, email: value['email'] as string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
