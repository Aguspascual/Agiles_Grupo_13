import { Injectable, signal } from '@angular/core';
import { AvailabilitySlot, WeeklyScheduleRule } from './availability.model';
import { generateAvailabilitySlots, isValidWeeklySchedule } from './availability-generator';

const V1_STORAGE_KEY = 'padelmatch.availability.v1';
const STORAGE_KEY = 'padelmatch.availability.v2';
const STORAGE_VERSION = 2;
const WEEKDAYS: WeeklyScheduleRule['weekday'][] = [1, 2, 3, 4, 5, 6, 7];

interface PersistedAvailability {
  version: 2;
  rulesByCourt: Record<string, WeeklyScheduleRule[]>;
  blockedSlotIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AvailabilityPreviewStore {
  private readonly rulesByCourt = signal<Record<string, WeeklyScheduleRule[]>>({});
  private readonly blockedSlotIds = signal<Set<string>>(new Set());
  readonly persistenceAvailable = signal(true);

  constructor() {
    const loaded = this.readStorage();
    if (!loaded) return;
    this.rulesByCourt.set(loaded.state.rulesByCourt);
    this.blockedSlotIds.set(new Set(loaded.state.blockedSlotIds));
    if (loaded.migrated) this.persist();
  }

  rulesFor(courtId: string): WeeklyScheduleRule[] {
    return cloneRules(this.rulesByCourt()[courtId] ?? createDefaultSchedule());
  }

  saveRules(courtId: string, rules: WeeklyScheduleRule[]): void {
    if (!courtId || !isValidWeeklySchedule(rules)) {
      throw new Error('La configuración semanal no es válida.');
    }
    this.rulesByCourt.update((current) => ({ ...current, [courtId]: cloneRules(rules) }));
    this.persist();
  }

  slotsFor(courtId: string, date: Date): AvailabilitySlot[] {
    return generateAvailabilitySlots(
      courtId,
      this.rulesFor(courtId),
      date,
      this.blockedSlotIds(),
    );
  }

  /**
   * HU-05: turnos de la fecha para la grilla del jugador. Si la cancha todavía no tiene horarios
   * guardados, usa `fallbackRules` (horarios de ejemplo) para que la demo no quede vacía.
   */
  slotsWithFallback(courtId: string, date: Date, fallbackRules: WeeklyScheduleRule[]): AvailabilitySlot[] {
    const saved = this.rulesByCourt()[courtId];
    return generateAvailabilitySlots(courtId, cloneRules(saved ?? fallbackRules), date, this.blockedSlotIds());
  }

  toggleBlocked(slotId: string): void {
    if (!slotId) return;
    this.blockedSlotIds.update((current) => {
      const next = new Set(current);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
    this.persist();
  }

  private readStorage(): { state: PersistedAvailability; migrated: boolean } | null {
    if (typeof window === 'undefined') return null;
    let current: string | null;
    let previous: string | null;
    try {
      current = window.localStorage.getItem(STORAGE_KEY);
      previous = current ? null : window.localStorage.getItem(V1_STORAGE_KEY);
    } catch {
      this.persistenceAvailable.set(false);
      return null;
    }

    if (current !== null) {
      try {
        const parsed: unknown = JSON.parse(current);
        return isPersistedAvailability(parsed)
          ? { state: parsed, migrated: false }
          : null;
      } catch {
        return null;
      }
    }

    if (!previous) return null;
    try {
      const parsed: unknown = JSON.parse(previous);
      const migrated = migrateV1(parsed);
      return migrated ? { state: migrated, migrated: true } : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    const state: PersistedAvailability = {
      version: STORAGE_VERSION,
      rulesByCourt: this.rulesByCourt(),
      blockedSlotIds: [...this.blockedSlotIds()],
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.persistenceAvailable.set(true);
    } catch {
      this.persistenceAvailable.set(false);
    }
  }
}

function createDefaultSchedule(): WeeklyScheduleRule[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    enabled: false,
    intervals: [],
    durationMinutes: 60,
  }));
}

function cloneRules(rules: WeeklyScheduleRule[]): WeeklyScheduleRule[] {
  return rules.map((rule) => ({
    ...rule,
    intervals: (rule.intervals ?? []).map((interval) => ({ ...interval })),
  }));
}

function isPersistedAvailability(value: unknown): value is PersistedAvailability {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<PersistedAvailability>;
  return state.version === STORAGE_VERSION && isRulesByCourt(state.rulesByCourt) &&
    Array.isArray(state.blockedSlotIds) && state.blockedSlotIds.every(isNonEmptyString);
}

function migrateV1(value: unknown): PersistedAvailability | null {
  if (!value || typeof value !== 'object') return null;
  const previous = value as {
    version?: unknown;
    rulesByCourt?: unknown;
    blockedSlotIds?: unknown;
  };
  if (
    previous.version !== 1 || !isRulesByCourtV1(previous.rulesByCourt) ||
    !Array.isArray(previous.blockedSlotIds) || !previous.blockedSlotIds.every(isNonEmptyString)
  ) return null;

  const rulesByCourt = Object.fromEntries(
    Object.entries(previous.rulesByCourt).map(([courtId, rules]) => [
      courtId,
      rules.map((rule) => ({
        weekday: rule.weekday,
        enabled: rule.enabled,
        intervals: rule.enabled
          ? [{ id: `legacy-${rule.weekday}`, opensAt: rule.opensAt, closesAt: rule.closesAt }]
          : [],
        durationMinutes: rule.durationMinutes,
      })),
    ]),
  ) as Record<string, WeeklyScheduleRule[]>;

  return {
    version: STORAGE_VERSION,
    rulesByCourt,
    blockedSlotIds: previous.blockedSlotIds,
  };
}

function isRulesByCourt(value: unknown): value is Record<string, WeeklyScheduleRule[]> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)) &&
    Object.values(value as Record<string, unknown>).every(isValidWeeklySchedule);
}

function isRulesByCourtV1(value: unknown): value is Record<string, LegacyRule[]> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)) &&
    Object.values(value as Record<string, unknown>).every(isLegacySchedule);
}

interface LegacyRule {
  weekday: WeeklyScheduleRule['weekday'];
  enabled: boolean;
  opensAt: string;
  closesAt: string;
  durationMinutes: 60 | 90;
}

function isLegacySchedule(value: unknown): value is LegacyRule[] {
  if (!Array.isArray(value) || value.length > WEEKDAYS.length) return false;
  const days = new Set<number>();
  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const rule = item as Partial<LegacyRule>;
    if (!WEEKDAYS.includes(rule.weekday as LegacyRule['weekday']) || days.has(rule.weekday as number) ||
      typeof rule.enabled !== 'boolean' || !isTime(rule.opensAt) || !isTime(rule.closesAt) ||
      ![60, 90].includes(rule.durationMinutes ?? 0)) return false;
    const open = minutesOfDay(rule.opensAt);
    const close = minutesOfDay(rule.closesAt);
    if (rule.enabled && (close <= open || close - open < rule.durationMinutes!)) return false;
    days.add(rule.weekday as number);
    return true;
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
