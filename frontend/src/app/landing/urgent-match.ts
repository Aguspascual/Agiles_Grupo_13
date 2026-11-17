import { MatchPreview } from './landing.data';

const BUENOS_AIRES_OFFSET = '-03:00';
const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * API dates/times are wall-clock values in the product timezone, Buenos Aires.
 * An explicit offset keeps parsing independent of the browser's timezone.
 */
export function isUrgentMatch(match: MatchPreview, now: Date): boolean {
  if (match.openSpots !== 1 && match.openSpots !== 2) return false;

  const startsAt = matchStartInstant(match.date, match.startsAt);
  if (startsAt === null) return false;

  const start = startsAt.getTime();
  const current = now.getTime();
  return start > current && start <= current + URGENT_WINDOW_MS;
}

function matchStartInstant(date: string | undefined, time: string | undefined): Date | null {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day ||
    hours > 23 ||
    minutes > 59
  ) {
    return null;
  }

  const instant = new Date(`${date}T${time}:00${BUENOS_AIRES_OFFSET}`);
  return Number.isFinite(instant.getTime()) ? instant : null;
}
