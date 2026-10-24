import { AvailabilitySlot } from '../availability/availability.model';
import { BookingRecord } from '../bookings/booking.model';
import { SlotRef } from '../bookings/booking-preview.store';
import { minutesOfDay, toDateKey } from '../shared/local-date';
import { DayGrid, GridComplex, GridCourt, GridSlot } from './slot-grid.model';

export interface GridSource {
  complex: GridComplex;
  courts: { id: string; name: string; covered: boolean }[];
  date: Date;
  now: Date;
  slotsFor: (courtId: string, date: Date) => AvailabilitySlot[];
  bookingFor: (slot: SlotRef) => BookingRecord | null;
}

/** Combina horarios (HU-04), bloqueos y reservas en la grilla de un día. */
export function buildDayGrid(source: GridSource): DayGrid {
  const courts: GridCourt[] = source.courts.map((court) => ({
    id: court.id,
    name: court.name,
    covered: court.covered,
    slots: source.slotsFor(court.id, source.date).map((slot) => toGridSlot(slot, source)),
  }));
  return { complex: source.complex, date: toDateKey(source.date), courts };
}

function toGridSlot(slot: AvailabilitySlot, source: GridSource): GridSlot {
  const base = {
    id: slot.id,
    courtId: slot.courtId,
    date: slot.date,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    isPast: hasStarted(slot.date, slot.startsAt, source.now),
  };
  if (slot.status === 'blocked') return { ...base, state: 'blocked' };

  const booking = source.bookingFor(slot);
  if (!booking) return { ...base, state: 'available' };
  if (booking.kind === 'class') return { ...base, state: 'class' };
  if (booking.kind === 'pending' && booking.pendingMatch) {
    return { ...base, state: 'pending', pendingMatch: { ...booking.pendingMatch } };
  }
  return { ...base, state: 'reserved' };
}

export function hasStarted(dateKey: string, startsAt: string, now: Date): boolean {
  const [year, month, day] = dateKey.split('-').map(Number);
  const minute = minutesOfDay(startsAt);
  const start = new Date(year, month - 1, day, Math.floor(minute / 60), minute % 60);
  return start.getTime() <= now.getTime();
}

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
