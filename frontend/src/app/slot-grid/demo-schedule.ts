import { WeeklyScheduleRule } from '../availability/availability.model';

/** Canchas de demostración con turnos de 60 minutos; el resto usa 90. */
const SIXTY_MINUTE_COURTS = new Set(['court-gonnet-2', 'court-citybell-2']);

/**
 * Horario de ejemplo para canchas que todavía no tienen horarios guardados en HU-04.
 * Lunes a viernes de 08:00 a 23:00 (09:00 en canchas de 60 min) y fines de semana de 09:00 a 21:00.
 */
export function demoScheduleFor(courtId: string): WeeklyScheduleRule[] {
  const duration = SIXTY_MINUTE_COURTS.has(courtId) ? 60 : 90;
  const weekdayOpening = duration === 60 ? '09:00' : '08:00';
  return ([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => {
    const weekend = weekday >= 6;
    return {
      weekday,
      enabled: true,
      durationMinutes: duration,
      intervals: [
        {
          id: `demo-${weekday}`,
          opensAt: weekend ? '09:00' : weekdayOpening,
          closesAt: weekend ? '21:00' : '23:00',
        },
      ],
    };
  });
}
