import {
  AvailabilitySlot,
  WeeklyScheduleRule,
  Weekday,
} from './availability.model';

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
  const rule = rules.find((candidate) => candidate.weekday === weekday && candidate.enabled);
  if (!rule || ![60, 90].includes(rule.durationMinutes)) return [];

  const slots: AvailabilitySlot[] = [];
  const dateKey = formatLocalDate(localDate);
  for (const interval of [...rule.intervals].sort((left, right) => left.opensAt.localeCompare(right.opensAt))) {
    const openingMinute = parseTime(interval.opensAt);
    const closingMinute = parseTime(interval.closesAt);
    if (openingMinute === null || closingMinute === null || closingMinute <= openingMinute) continue;

    for (
      let startMinute = openingMinute;
      startMinute + rule.durationMinutes <= closingMinute;
      startMinute += rule.durationMinutes
    ) {
      const startsAt = formatTime(startMinute);
      const endsAt = formatTime(startMinute + rule.durationMinutes);
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
  return slots;
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
      const start = minutesOfDay(interval.opensAt);
      const end = minutesOfDay(interval.closesAt);
      if (end <= start || end - start < rule.durationMinutes!) return false;
      ranges.push({ start, end });
      ids.add(interval.id);
    }

    ranges.sort((left, right) => left.start - right.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].start < ranges[index - 1].end) return false;
    }
    weekdays.add(rule.weekday);
    return true;
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
