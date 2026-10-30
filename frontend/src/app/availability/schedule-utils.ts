import { HttpErrorResponse } from '@angular/common/http';
import { WeeklyScheduleRule } from './availability.model';

/** Días del formulario que difieren de lo guardado, con la `revision` vigente de cada uno. */
export function changedDays(current: WeeklyScheduleRule[], incoming: WeeklyScheduleRule[]): WeeklyScheduleRule[] {
  const saved = new Map(current.map((rule) => [rule.weekday, rule]));
  return incoming
    .filter((rule) => {
      const base = saved.get(rule.weekday);
      return !base || signature(base) !== signature(rule);
    })
    .map((rule) => ({ ...rule, revision: saved.get(rule.weekday)?.revision }));
}

function signature(rule: WeeklyScheduleRule): string {
  const intervals = rule.intervals
    .map(({ opensAt, closesAt }) => `${opensAt}-${closesAt}`)
    .sort();
  return JSON.stringify([rule.enabled, rule.durationMinutes, intervals]);
}

function errorStatus(error: unknown): number {
  return error instanceof HttpErrorResponse ? error.status : -1;
}

function errorText(error: unknown): string {
  const body = error instanceof HttpErrorResponse ? (error.error as { error?: unknown } | null) : null;
  return typeof body?.error === 'string' ? body.error : '';
}

export function loadMessage(error: unknown): string {
  switch (errorStatus(error)) {
    case 403: return 'No tenés permisos sobre este complejo.';
    case 0: return 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
    default: return 'No pudimos cargar los horarios. Intentá nuevamente.';
  }
}

export function saveMessage(error: unknown): string {
  switch (errorStatus(error)) {
    case 400: return 'Revisá los horarios.';
    case 403: return 'No tenés permisos para esta acción.';
    case 404: return 'La cancha ya no existe.';
    case 409:
      return errorText(error).includes('reservas')
        ? 'El cambio afecta reservas futuras vigentes.'
        : 'El horario cambió; actualizamos los datos.';
    case 412: return 'El horario cambió; actualizamos los datos.';
    case 0: return 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
    default: return 'No pudimos guardar los horarios. Intentá nuevamente.';
  }
}
