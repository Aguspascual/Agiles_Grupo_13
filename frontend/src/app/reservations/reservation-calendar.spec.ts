import { createGoogleCalendarUrl, createReservationCalendar } from './reservation-calendar';

const booking = {
  reservationId: 'r-123',
  startsAt: '2026-11-18T23:30:00-03:00',
  endsAt: '2026-11-19T01:00:00-03:00',
  complex: { name: 'Complejo Árbol' },
  court: { name: 'Cancha 2' },
};
const stamp = new Date('2026-11-16T12:00:00Z');
const unfold = (value: string) => value.replace(/\r\n /g, '');

describe('reservation iCalendar', () => {
  it('exports one event with actual UTC instants across midnight and a stable UID', () => {
    const ics = createReservationCalendar(booking, 'Av. Córdoba 123', stamp);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART:20261119T023000Z\r\n');
    expect(ics).toContain('DTEND:20261119T040000Z\r\n');
    expect(ics).toContain('DTSTAMP:20261116T120000Z\r\n');
    expect(ics).toContain('SUMMARY:Complejo Árbol · Cancha 2');
    expect(unfold(ics)).toContain('LOCATION:Complejo Árbol · Cancha 2 · Av. Córdoba 123');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const later = createReservationCalendar(booking, undefined, new Date('2026-11-17T12:00:00Z'));
    expect(ics.match(/UID:.*/)?.[0]).toBe(later.match(/UID:.*/)?.[0]);
    expect(later).toContain('LOCATION:Complejo Árbol · Cancha 2\r\n');
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|CONTACT|RRULE|METHOD/);
  });

  it('escapes text and folds at 75 UTF-8 octets without splitting characters', () => {
    const name = 'Árbol, Sur; \\ Club\r\nNueva línea 🎾'.repeat(7);
    const ics = createReservationCalendar({ ...booking, complex: { name } }, undefined, stamp);
    expect(unfold(ics)).toContain('Árbol\\, Sur\\; \\\\ Club\\nNueva línea 🎾');
    expect(ics).toContain('\r\n ');
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      expect(line).not.toContain('\ufffd');
    }
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('preserves UTC timestamps and positive offsets', () => {
    const ics = createReservationCalendar({ ...booking,
      startsAt: '2026-11-19T02:30:00Z', endsAt: '2026-11-19T09:30:00+05:30',
    }, undefined, stamp);
    expect(ics).toContain('DTSTART:20261119T023000Z');
    expect(ics).toContain('DTEND:20261119T040000Z');
  });

  it.each([
    ['', booking.endsAt], ['invalid', booking.endsAt],
    ['2026-11-18T23:30:00', booking.endsAt],
    ['2026-02-30T23:30:00Z', booking.endsAt],
    [booking.startsAt, 'invalid'], [booking.startsAt, booking.startsAt],
    [booking.endsAt, booking.startsAt],
  ])('rejects invalid or unordered timestamps: %s / %s', (startsAt, endsAt) => {
    expect(() => createReservationCalendar({ ...booking, startsAt, endsAt }, undefined, stamp)).toThrow();
    expect(() => createGoogleCalendarUrl({ ...booking, startsAt, endsAt })).toThrow();
  });
});

describe('Google Calendar event link', () => {
  it('prefills actual UTC instants and round-trips special text without injecting parameters', () => {
    const name = 'Árbol, Sur; Club & Cancha #1 + 🎾';
    const address = 'Calle 123 & esquina 4, Gonnet';
    const url = new URL(createGoogleCalendarUrl({ ...booking, complex: { name } }, address));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/r/eventedit');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261119T023000Z/20261119T040000Z');
    expect(url.searchParams.get('text')).toBe(`${name} · Cancha 2`);
    expect(url.searchParams.get('location')).toBe(`${name} · Cancha 2 · ${address}`);
    expect([...url.searchParams.keys()].sort()).toEqual(['action', 'dates', 'location', 'text']);
    expect(url.hash).toBe('');
  });

  it.each([undefined, '', '  '])('keeps complex and court without an address (%s)', address => {
    const url = new URL(createGoogleCalendarUrl(booking, address));
    expect(url.searchParams.get('location')).toBe('Complejo Árbol · Cancha 2');
  });
});
