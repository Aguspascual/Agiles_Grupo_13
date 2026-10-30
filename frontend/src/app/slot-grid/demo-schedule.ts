import { WeeklyScheduleRule } from '../availability/availability.model';
import { CourtFeatureId } from '../courts/court.model';

export interface DemoCourt {
  id: string;
  complexId: string;
  name: string;
  covered: boolean;
  features: CourtFeatureId[];
}

/** Canchas de demostración de la grilla pública (HU-05); no provienen de la API de canchas. */
export const DEMO_COURTS: DemoCourt[] = [
  { id: 'court-gonnet-1', complexId: 'complex-gonnet', name: 'Cancha 1', covered: true, features: [] },
  { id: 'court-gonnet-2', complexId: 'complex-gonnet', name: 'Cancha 2', covered: false, features: ['lighting', 'wifi'] },
  { id: 'court-centro-1', complexId: 'complex-centro', name: 'Cancha 1', covered: false, features: ['electronicScoreboard'] },
  { id: 'court-cumbre-1', complexId: 'complex-cumbre', name: 'Cancha 1', covered: true, features: ['lighting', 'acrylicSurface'] },
  { id: 'court-cumbre-2', complexId: 'complex-cumbre', name: 'Cancha 2', covered: true, features: ['lighting'] },
  { id: 'court-cumbre-3', complexId: 'complex-cumbre', name: 'Cancha 3', covered: false, features: ['lighting', 'electronicScoreboard'] },
  { id: 'court-citybell-1', complexId: 'complex-citybell', name: 'Cancha 1', covered: false, features: ['lighting', 'wifi'] },
  { id: 'court-citybell-2', complexId: 'complex-citybell', name: 'Cancha 2', covered: false, features: ['lighting'] },
  { id: 'court-estudiantes-1', complexId: 'complex-estudiantes', name: 'Cancha Central', covered: true, features: ['lighting', 'electronicScoreboard', 'acrylicSurface'] },
  { id: 'court-estudiantes-2', complexId: 'complex-estudiantes', name: 'Cancha 2', covered: false, features: ['lighting'] },
];

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
