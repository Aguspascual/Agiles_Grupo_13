import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ScheduleInterval, WeeklyScheduleRule, Weekday } from './availability.model';

const SCHEDULE_API = (complexId: string, courtId: string) =>
  `/api/v1/complexes/${encodeURIComponent(complexId)}/courts/${encodeURIComponent(courtId)}/weekly-schedule/days`;
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

@Injectable({ providedIn: 'root' })
export class ScheduleApiService {
  private readonly http = inject(HttpClient);

  /** Siempre devuelve los 7 días; los que el backend no tiene quedan como "no configurados". */
  load(complexId: string, courtId: string): Observable<WeeklyScheduleRule[]> {
    return this.http.get<unknown>(SCHEDULE_API(complexId, courtId)).pipe(map(parseDayList));
  }

  /** PUT con `If-Match` si el día ya existe en el backend; POST si todavía no está configurado. */
  saveDay(complexId: string, courtId: string, rule: WeeklyScheduleRule): Observable<WeeklyScheduleRule> {
    const base = SCHEDULE_API(complexId, courtId);
    const body = {
      enabled: rule.enabled,
      durationMinutes: rule.durationMinutes,
      intervals: rule.intervals.map(({ opensAt, closesAt }) => ({ opensAt, closesAt })),
    };
    if (rule.revision) {
      const headers = new HttpHeaders({ 'If-Match': `"${rule.revision}"` });
      return this.http
        .put<unknown>(`${base}/${rule.weekday}`, body, { headers })
        .pipe(map(parseDayEnvelope));
    }
    return this.http.post<unknown>(base, { weekday: rule.weekday, ...body }).pipe(map(parseDayEnvelope));
  }
}

export function emptyWeek(): WeeklyScheduleRule[] {
  return WEEKDAYS.map((weekday) => ({ weekday, enabled: false, intervals: [], durationMinutes: 60 }));
}

function parseDayList(value: unknown): WeeklyScheduleRule[] {
  if (!isRecord(value) || !Array.isArray(value['days'])) throw new Error('Respuesta de horarios inválida');
  const configured = new Map(value['days'].map(parseDay).map((day) => [day.weekday, day]));
  return emptyWeek().map((fallback) => configured.get(fallback.weekday) ?? fallback);
}

function parseDayEnvelope(value: unknown): WeeklyScheduleRule {
  if (!isRecord(value)) throw new Error('Respuesta de horario inválida');
  return parseDay(value['day']);
}

function parseDay(value: unknown): WeeklyScheduleRule {
  if (
    !isRecord(value) ||
    !WEEKDAYS.includes(value['weekday'] as Weekday) ||
    typeof value['enabled'] !== 'boolean' ||
    (value['durationMinutes'] !== 60 && value['durationMinutes'] !== 90) ||
    typeof value['revision'] !== 'string' ||
    !Array.isArray(value['intervals'])
  ) {
    throw new Error('Datos de horario inválidos');
  }
  return {
    weekday: value['weekday'] as Weekday,
    enabled: value['enabled'],
    intervals: value['intervals'].map(parseInterval),
    durationMinutes: value['durationMinutes'],
    revision: value['revision'],
  };
}

function parseInterval(value: unknown): ScheduleInterval {
  if (
    !isRecord(value) ||
    ['id', 'opensAt', 'closesAt'].some((key) => typeof value[key] !== 'string')
  ) {
    throw new Error('Datos de franja inválidos');
  }
  return {
    id: value['id'] as string,
    opensAt: value['opensAt'] as string,
    closesAt: value['closesAt'] as string,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
