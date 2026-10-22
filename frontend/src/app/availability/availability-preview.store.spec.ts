import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityPreviewStore } from './availability-preview.store';
import { WeeklyScheduleRule } from './availability.model';

const V1_KEY = 'padelmatch.availability.v1';
const V2_KEY = 'padelmatch.availability.v2';
const monday: WeeklyScheduleRule = {
  weekday: 1,
  enabled: true,
  intervals: [
    { id: 'morning', opensAt: '09:00', closesAt: '13:00' },
    { id: 'evening', opensAt: '17:00', closesAt: '22:00' },
  ],
  durationMinutes: 60,
};

describe('AvailabilityPreviewStore', () => {
  let memory: Map<string, string>;
  let writesEnabled: boolean;

  beforeEach(() => {
    memory = new Map();
    writesEnabled = true;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (!writesEnabled) throw new Error('Storage bloqueado');
          memory.set(key, value);
        },
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts with seven disabled empty days when there is no saved configuration', () => {
    const rules = new AvailabilityPreviewStore().rulesFor('court-1');

    expect(rules).toHaveLength(7);
    expect(rules.every((rule) => !rule.enabled && (rule.intervals ?? []).length === 0)).toBe(true);
    expect(rules.every((rule) => rule.durationMinutes === 60)).toBe(true);
  });

  it('round-trips v2 rules containing multiple daily intervals', () => {
    const store = new AvailabilityPreviewStore();
    store.saveRules('court-1', [monday]);

    expect(JSON.parse(memory.get(V2_KEY) ?? '{}')).toMatchObject({ version: 2 });
    expect(new AvailabilityPreviewStore().rulesFor('court-1')).toEqual([monday]);
  });

  it('migrates an active v1 day into an interval while preserving blocked ids and the backup', () => {
    const v1 = {
      version: 1,
      rulesByCourt: {
        'court-1': [
          { weekday: 1, enabled: true, opensAt: '09:00', closesAt: '10:00', durationMinutes: 60 },
        ],
      },
      blockedSlotIds: ['court-1:2026-10-12:09:00'],
    };
    const original = JSON.stringify(v1);
    memory.set(V1_KEY, original);

    const store = new AvailabilityPreviewStore();

    expect(store.rulesFor('court-1')).toEqual([{
      weekday: 1,
      enabled: true,
      intervals: [{ id: 'legacy-1', opensAt: '09:00', closesAt: '10:00' }],
      durationMinutes: 60,
    }]);
    expect(store.slotsFor('court-1', new Date(2026, 9, 12, 12))[0].status).toBe('blocked');
    expect(memory.get(V1_KEY)).toBe(original);
    expect(JSON.parse(memory.get(V2_KEY) ?? '{}')).toMatchObject({ version: 2 });
  });

  it('uses valid v2 ahead of v1 and recovers safely from malformed storage', () => {
    memory.set(V1_KEY, JSON.stringify({ version: 1, rulesByCourt: {}, blockedSlotIds: [] }));
    memory.set(V2_KEY, JSON.stringify({ version: 2, rulesByCourt: { 'court-1': [monday] }, blockedSlotIds: [] }));
    expect(new AvailabilityPreviewStore().rulesFor('court-1')).toEqual([monday]);

    memory.set(V2_KEY, '{not-json');
    expect(new AvailabilityPreviewStore().rulesFor('court-1').every((rule) => !rule.enabled)).toBe(true);
  });

  it('rejects invalid weekly rules without replacing the saved snapshot', () => {
    const store = new AvailabilityPreviewStore();
    store.saveRules('court-1', [monday]);
    const saved = memory.get(V2_KEY);

    expect(() => store.saveRules('court-1', [{ ...monday, intervals: [
      { id: 'a', opensAt: '09:00', closesAt: '12:00' },
      { id: 'b', opensAt: '11:00', closesAt: '14:00' },
    ] }])).toThrow('La configuración semanal no es válida.');
    expect(memory.get(V2_KEY)).toBe(saved);
  });

  it('keeps the demo usable in memory and exposes unavailable storage writes', () => {
    writesEnabled = false;
    const store = new AvailabilityPreviewStore();
    store.saveRules('court-1', [monday]);

    expect(store.persistenceAvailable()).toBe(false);
    expect(store.rulesFor('court-1')).toEqual([monday]);
  });
});
