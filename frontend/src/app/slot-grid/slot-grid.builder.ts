import { minutesOfDay } from '../shared/local-date';
import { GridCourt, GridSlot } from './slot-grid.model';

/** Tramo de horas con turnos: las horas sin turnos entre tramos no se dibujan. */
export interface GridSegment {
  /** Hora en punto con la que empieza el tramo. */
  start: number;
  end: number;
  /** Cantidad de filas anteriores a este tramo (0 para el primero). */
  rowStart: number;
}

export interface GridLayout {
  /** Primer minuto visible (hora en punto). */
  startMinute: number;
  endMinute: number;
  /** Minutos que representa cada fila. */
  step: number;
  rowCount: number;
  hourMarks: { label: string; row: number }[];
  segments: GridSegment[];
}

export function layoutFor(courts: GridCourt[]): GridLayout | null {
  const slots = courts.flatMap((court) => court.slots);
  if (!slots.length) return null;

  const starts = slots.map((slot) => minutesOfDay(slot.startsAt));
  const ends = slots.map((slot) => slotEndMinute(slot));
  const startMinute = Math.floor(Math.min(...starts) / 60) * 60;
  const endMinute = Math.ceil(Math.max(...ends) / 60) * 60;
  const step = Math.max(
    5,
    [...starts, ...ends].reduce((acc, minute) => gcd(acc, minute - startMinute), 30),
  );

  const ranges = mergeRanges(
    slots.map((slot) => ({
      start: Math.floor(minutesOfDay(slot.startsAt) / 60) * 60,
      end: Math.ceil(slotEndMinute(slot) / 60) * 60,
    })),
  );
  const segments: GridSegment[] = [];
  const hourMarks: GridLayout['hourMarks'] = [];
  let rowStart = 0;
  for (const range of ranges) {
    segments.push({ ...range, rowStart });
    for (let minute = range.start; minute < range.end; minute += 60) {
      hourMarks.push({
        label: `${String(minute / 60).padStart(2, '0')}:00`,
        row: rowStart + (minute - range.start) / step + 1,
      });
    }
    rowStart += (range.end - range.start) / step;
  }
  return { startMinute, endMinute, step, rowCount: rowStart, hourMarks, segments };
}

/** Fila inicial (1 = primera fila de turnos) y cantidad de filas que ocupa un turno. */
export function placementFor(slot: GridSlot, layout: GridLayout): { row: number; span: number } {
  const start = minutesOfDay(slot.startsAt);
  const end = slotEndMinute(slot);
  const segment = layout.segments.find((item) => start >= item.start && start < item.end) ?? layout.segments[0];
  return {
    row: segment.rowStart + Math.round((start - segment.start) / layout.step) + 1,
    span: Math.max(1, Math.round((end - start) / layout.step)),
  };
}

/** Filas que hay antes de un minuto del día; si cae en un hueco, apunta al tramo siguiente. */
export function rowsBefore(layout: GridLayout, minute: number): number {
  for (const segment of layout.segments) {
    if (minute < segment.start) return segment.rowStart;
    if (minute < segment.end) return segment.rowStart + (minute - segment.start) / layout.step;
  }
  return layout.rowCount;
}

export function isInsideSegment(layout: GridLayout, minute: number): boolean {
  return layout.segments.some((segment) => minute >= segment.start && minute <= segment.end);
}

/** Un turno que termina a las 00:00 (o antes de empezar) termina a medianoche, no al inicio del día. */
function slotEndMinute(slot: GridSlot): number {
  const start = minutesOfDay(slot.startsAt);
  const end = minutesOfDay(slot.endsAt);
  return end <= start ? end + 24 * 60 : end;
}

function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a;
}