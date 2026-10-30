export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SlotStatus = 'available' | 'blocked';

export interface ScheduleInterval {
  id: string;
  opensAt: string;
  closesAt: string;
}

export interface WeeklyScheduleRule {
  weekday: Weekday;
  enabled: boolean;
  intervals: ScheduleInterval[];
  durationMinutes: 60 | 90;
  /** Presente solo si el día existe en el backend; se envía como `If-Match`. */
  revision?: string;
}

export interface AvailabilitySlot {
  id: string;
  courtId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
}
