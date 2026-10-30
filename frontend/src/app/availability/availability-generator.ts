import {
  AvailabilitySlot,
  WeeklyScheduleRule,
  Weekday,
} from './availability.model';

const MINUTES_PER_DAY = 24 * 60;

/** Minutos desde la apertura del día; si cierra antes de abrir, la franja termina al día siguiente. */
export function intervalRange(interval: { opensAt: string; closesAt: string }): { start: number; end: number } | null {
  const start = parseTime(interval.opensAt);
  const end = parseTime(interval.closesAt);
  if (start === null || end === null || start === end) return null;
  return { start, end: end < start ? end + MINUTES_PER_DAY : end };
}

export function generateAvailabilitySlots(
  courtId: string,
  rules: WeeklyScheduleRule[],
  date: Date,
  blockedSlotIds?: ReadonlySet<string>,
): AvailabilitySlot[];
export function generateAvailabilitySlots(
  courtId: string,
  rules: WeeklyScheduleRule[],
  date: Date,
  blockedSlotIds: ReadonlySet<string> = new Set(),
): AvailabilitySlot[] {
  if (!courtId || Number.isNaN(date.getTime())) return [];
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekday = localWeekday(localDate);
  const previousWeekday = (weekday === 1 ? 7 : weekday - 1) as Weekday;
  const usable = (candidate: WeeklyScheduleRule | undefined): candidate is WeeklyScheduleRule =>
    !!candidate && candidate.enabled && [60, 90].includes(candidate.durationMinutes);
  const today = rules.find((candidate) => candidate.weekday === weekday);
  const previous = rules.find((candidate) => candidate.weekday === previousWeekday);
  // Las franjas que cruzan la medianoche del día anterior siguen en las primeras horas de este día.
  const sources = [
    ...(usable(today) ? [{ rule: today, shift: 0 }] : []),
    ...(usable(previous) ? [{ rule: previous, shift: MINUTES_PER_DAY }] : []),
  ];

  const slots: AvailabilitySlot[] = [];
  const dateKey = formatLocalDate(localDate);
  for (const source of sources) {
    for (const interval of [...source.rule.intervals].sort((left, right) => left.opensAt.localeCompare(right.opensAt))) {
      const range = intervalRange(interval);
      if (!range) continue;
      for (
        let startMinute = range.start;
        startMinute + source.rule.durationMinutes <= range.end;
        startMinute += source.rule.durationMinutes
      ) {
        const minute = startMinute - source.shift;
        if (minute < 0) continue;
        if (minute >= MINUTES_PER_DAY) break;
        const startsAt = formatTime(minute);
        const endsAt = formatTime((minute + source.rule.durationMinutes) % MINUTES_PER_DAY);
        const id = `${courtId}:${dateKey}:${startsAt}`;
        slots.push({
          id,
          courtId,
          date: dateKey,
          startsAt,
          endsAt,
          status: blockedSlotIds.has(id) ? 'blocked' : 'available',
        });
      }
    }
  }
  return slots.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}
export function isValidWeeklySchedule(value: unknown): value is WeeklyScheduleRule[] {
  if (!Array.isArray(value) || value.length > 7) return false;
  const weekdays = new Set<number>();

  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const rule = item as Partial<WeeklyScheduleRule>;
    if (
      !isWeekday(rule.weekday) ||
      weekdays.has(rule.weekday) ||
      typeof rule.enabled !== 'boolean' ||
      ![60, 90].includes(rule.durationMinutes ?? 0) ||
      !Array.isArray(rule.intervals) ||
      (rule.enabled && rule.intervals.length === 0)
    ) {
      return false;
    }

    const ids = new Set<string>();
    const ranges: { start: number; end: number }[] = [];
    for (const interval of rule.intervals) {
      if (
        !interval ||
        typeof interval !== 'object' ||
        typeof interval.id !== 'string' ||
        !interval.id.trim() ||
        ids.has(interval.id) ||
        !isTime(interval.opensAt) ||
        !isTime(interval.closesAt)
      ) {
        return false;
      }
      const range = intervalRange(interval);
      if (!range) return false;
      const { start, end } = range;
      if (end - start < rule.durationMinutes!) return false;
      ranges.push({ start, end });
      ids.add(interval.id);
    }

    ranges.sort((left, right) => left.start - right.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].start < ranges[index - 1].end) return false;
    }
    weekdays.add(rule.weekday);
    return true;
  }) && !overnightOverlapsNextDay(value as WeeklyScheduleRule[]);
}

/** Una franja que pasa de medianoche no puede pisar la apertura del día siguiente. */
function overnightOverlapsNextDay(rules: WeeklyScheduleRule[]): boolean {
  return rules.some((rule) => {
    const spillEnd = Math.max(0, ...rule.intervals.map((interval) => (intervalRange(interval)?.end ?? 0) - MINUTES_PER_DAY));
    if (!spillEnd) return false;
    const next = rules.find((candidate) => candidate.weekday === (rule.weekday === 7 ? 1 : rule.weekday + 1));
    const firstOpening = Math.min(MINUTES_PER_DAY, ...(next?.intervals ?? []).map((interval) => intervalRange(interval)?.start ?? MINUTES_PER_DAY));
    return firstOpening < spillEnd;
  });
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function localWeekday(date: Date): Weekday {
  return (date.getDay() || 7) as Weekday;
}

function parseTime(value: string): number | null {
  if (!isTime(value)) return null;
  return minutesOfDay(value);
}

function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const remainder = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${remainder}`;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
