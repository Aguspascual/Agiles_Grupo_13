/** Calendar export builders. No DOM, network or localized display labels. */
export interface CalendarReservation {
  reservationId: string;
  startsAt: string;
  endsAt: string;
  complex: { name: string };
  court: { name: string };
}

export const INVALID_CALENDAR_TIME = 'No se pudo agregar al calendario: los horarios de la reserva no son válidos.';

export function createReservationCalendar(
  reservation: CalendarReservation,
  address?: string,
  createdAt = new Date(),
): string {
  const { start, end, summary, location } = eventData(reservation, address);
  if (!Number.isFinite(createdAt.getTime())) throw new Error(INVALID_CALENDAR_TIME);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Padel//Reservas//ES',
    'BEGIN:VEVENT',
    `UID:reservation-${encodeURIComponent(reservation.reservationId)}@padel.local`,
    `DTSTAMP:${utc(createdAt)}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`,
    `SUMMARY:${escapeText(summary)}`, `LOCATION:${escapeText(location)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n';
}

/** Opens an editable draft in Google Calendar; the user still chooses Save. */
export function createGoogleCalendarUrl(reservation: CalendarReservation, address?: string): string {
  const { start, end, summary, location } = eventData(reservation, address);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: summary,
    dates: `${utc(start)}/${utc(end)}`,
    location,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

function eventData(reservation: CalendarReservation, address?: string) {
  const start = parseInstant(reservation.startsAt);
  const end = parseInstant(reservation.endsAt);
  if (end.getTime() <= start.getTime()) throw new Error(INVALID_CALENDAR_TIME);
  const summary = `${reservation.complex.name} · ${reservation.court.name}`;
  const location = address?.trim() ? `${summary} · ${address.trim()}` : summary;
  return { start, end, summary, location };
}

function parseInstant(value: string): Date {
  // Require an explicit offset and reject impossible dates instead of Date's rollover.
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const date = new Date(value);
  if (!parts || !Number.isFinite(date.getTime())) throw new Error(INVALID_CALENDAR_TIME);
  const [, year, month, day, hour, minute, second, offset] = parts;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth ||
      Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
      (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59)) ||
      date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) {
    throw new Error(INVALID_CALENDAR_TIME);
  }
  // iCalendar DATE-TIME has second precision.
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function utc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let result = '';
  let octets = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (octets + length > 75) {
      result += '\r\n ';
      octets = 1;
    }
    result += character;
    octets += length;
  }
  return result;
}
