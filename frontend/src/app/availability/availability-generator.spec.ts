import { describe, expect, it } from 'vitest';
import { generateAvailabilitySlots, isValidWeeklySchedule } from './availability-generator';
import { ScheduleInterval, WeeklyScheduleRule } from './availability.model';

const monday = new Date(2026, 9, 12, 12);

function interval(id: string, opensAt: string, closesAt: string): ScheduleInterval {
  return { id, opensAt, closesAt };
}

function rule(
  weekday: WeeklyScheduleRule['weekday'],
  intervals: ScheduleInterval[],
  durationMinutes: WeeklyScheduleRule['durationMinutes'] = 60,
  enabled = true,
): WeeklyScheduleRule {
  return { weekday, enabled, intervals, durationMinutes };
}

describe('generateAvailabilitySlots', () => {
  it('generates independent slots from two intervals on the selected date', () => {
    const slots = generateAvailabilitySlots(
      'court-1',
      [rule(1, [interval('morning', '09:00', '13:00'), interval('evening', '17:00', '22:00')])],
      monday,
    );

    expect(slots.map(({ startsAt, endsAt }) => [startsAt, endsAt])).toEqual([
      ['09:00', '10:00'],
      ['10:00', '11:00'],
      ['11:00', '12:00'],
      ['12:00', '13:00'],
      ['17:00', '18:00'],
      ['18:00', '19:00'],
      ['19:00', '20:00'],
      ['20:00', '21:00'],
      ['21:00', '22:00'],
    ]);
    expect(slots.every((slot) => slot.date === '2026-10-12')).toBe(true);
  });

  it('generates 90-minute slots without extending beyond interval closing', () => {
    const slots = generateAvailabilitySlots(
      'court-1',
      [rule(1, [interval('morning', '09:00', '12:00')], 90)],
      monday,
    );

    expect(slots.map(({ startsAt, endsAt }) => [startsAt, endsAt])).toEqual([
      ['09:00', '10:30'],
      ['10:30', '12:00'],
    ]);
  });

  it('does not generate slots for disabled days', () => {
    expect(
      generateAvailabilitySlots(
        'court-1',
        [rule(1, [interval('morning', '09:00', '18:00')], 60, false)],
        monday,
      ),
    ).toEqual([]);
  });

  it('keeps slot identifiers stable and applies blocked status', () => {
    const schedule = [rule(1, [interval('morning', '09:00', '10:00')])];
    const slotId = 'court-1:2026-10-12:09:00';

    const first = generateAvailabilitySlots('court-1', schedule, monday);
    const blocked = generateAvailabilitySlots('court-1', schedule, monday, new Set([slotId]));

    expect(first[0].id).toBe(slotId);
    expect(blocked[0].id).toBe(first[0].id);
    expect(blocked[0].status).toBe('blocked');
  });

  it('generates only the selected local date across month and year boundaries', () => {
    const monthEnd = new Date(2026, 0, 31, 12);
    const yearEnd = new Date(2026, 11, 31, 12);

    const monthSlots = generateAvailabilitySlots(
      'court-1',
      [rule(6, [interval('weekend', '09:00', '10:00')])],
      monthEnd,
    );
    const yearSlots = generateAvailabilitySlots(
      'court-1',
      [rule(4, [interval('weekday', '09:00', '10:00')])],
      yearEnd,
    );

    expect(monthSlots.map((slot) => slot.date)).toEqual(['2026-01-31']);
    expect(yearSlots.map((slot) => slot.date)).toEqual(['2026-12-31']);
  });
});

describe('franjas que cruzan la medianoche', () => {
  const week = [rule(1, [interval('morning', '08:00', '12:00'), interval('night', '17:00', '01:00')])];

  it('genera los turnos nocturnos hasta las 00:00 y el resto en el día siguiente', () => {
    const mondaySlots = generateAvailabilitySlots('court-1', week, monday);
    expect(mondaySlots.map(({ startsAt, endsAt }) => `${startsAt}-${endsAt}`)).toEqual([
      '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '17:00-18:00', '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-22:00', '22:00-23:00', '23:00-00:00',
    ]);

    const tuesday = new Date(2026, 9, 13, 12);
    const spill = generateAvailabilitySlots('court-1', week, tuesday);
    expect(spill.map(({ startsAt, endsAt, date }) => `${date} ${startsAt}-${endsAt}`)).toEqual(['2026-10-13 00:00-01:00']);
  });

  it('acepta 8:00 a 12:00 y 17:00 a 01:00 en el mismo día', () => {
    expect(isValidWeeklySchedule(week)).toBe(true);
  });

  it('rechaza una franja nocturna que pisa otra del mismo día', () => {
    expect(isValidWeeklySchedule([rule(1, [interval('night', '17:00', '01:00'), interval('late', '20:00', '22:00')])])).toBe(false);
  });

  it('rechaza una apertura del día siguiente anterior al cierre nocturno', () => {
    expect(isValidWeeklySchedule([...week, rule(2, [interval('early', '00:30', '10:00')])])).toBe(false);
    expect(isValidWeeklySchedule([...week, rule(2, [interval('morning', '08:00', '10:00')])])).toBe(true);
  });

  it('rechaza una franja con apertura y cierre iguales', () => {
    expect(isValidWeeklySchedule([rule(1, [interval('same', '09:00', '09:00')])])).toBe(false);
  });
});

describe('isValidWeeklySchedule', () => {
  it('accepts non-overlapping same-day intervals and disabled days without intervals', () => {
    expect(
      isValidWeeklySchedule([
        rule(1, [interval('morning', '09:00', '13:00'), interval('evening', '17:00', '22:00')]),
        rule(2, [], 60, false),
      ]),
    ).toBe(true);
  });

  it('rejects overlapping intervals', () => {
    expect(
      isValidWeeklySchedule([
        rule(1, [interval('first', '09:00', '13:00'), interval('second', '12:30', '17:00')]),
      ]),
    ).toBe(false);
  });

  it('rejects invalid times and intervals that cannot fit one full slot', () => {
    expect(isValidWeeklySchedule([rule(1, [interval('invalid', '25:00', '27:00')])])).toBe(false);
    expect(isValidWeeklySchedule([rule(1, [interval('short', '09:00', '09:30')])])).toBe(false);
  });

  it('rejects enabled days without intervals and duplicate weekdays', () => {
    expect(isValidWeeklySchedule([rule(1, [])])).toBe(false);
    expect(
      isValidWeeklySchedule([
        rule(1, [interval('first', '09:00', '12:00')]),
        rule(1, [interval('second', '13:00', '16:00')]),
      ]),
    ).toBe(false);
  });
});
