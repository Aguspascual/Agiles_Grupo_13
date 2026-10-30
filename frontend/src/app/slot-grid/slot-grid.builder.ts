import { minutesOfDay } from '../shared/local-date';
import { GridCourt, GridSlot } from './slot-grid.model';

export interface GridLayout {
  /** Primer minuto visible (hora en punto). */
  startMinute: number;
  endMinute: number;
  /** Minutos que representa cada fila. */
  step: number;
  rowCount: number;
  hourMarks: { label: string; row: number }[];
}

export function layoutFor(courts: GridCourt[]): GridLayout | null {
  const slots = courts.flatMap((court) => court.slots);
  if (!slots.length) return null;

  const starts = slots.map((slot) => minutesOfDay(slot.startsAt));
  const ends = slots.map((slot) => minutesOfDay(slot.endsAt));
  const startMinute = Math.floor(Math.min(...starts) / 60) * 60;
  const endMinute = Math.ceil(Math.max(...ends) / 60) * 60;
  const step = Math.max(
    5,
    [...starts, ...ends].reduce((acc, minute) => gcd(acc, minute - startMinute), 30),
  );

  const hourMarks: GridLayout['hourMarks'] = [];
  for (let minute = startMinute; minute < endMinute; minute += 60) {
    hourMarks.push({
      label: `${String(minute / 60).padStart(2, '0')}:00`,
      row: (minute - startMinute) / step + 1,
    });
  }
  return { startMinute, endMinute, step, rowCount: (endMinute - startMinute) / step, hourMarks };
}

/** Fila inicial (1 = primera fila de turnos) y cantidad de filas que ocupa un turno. */
export function placementFor(slot: GridSlot, layout: GridLayout): { row: number; span: number } {
  const start = minutesOfDay(slot.startsAt);
  const end = minutesOfDay(slot.endsAt);
  return {
    row: Math.round((start - layout.startMinute) / layout.step) + 1,
    span: Math.max(1, Math.round((end - start) / layout.step)),
  };
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a;
}
