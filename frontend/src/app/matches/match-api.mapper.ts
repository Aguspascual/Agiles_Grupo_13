import { MatchPreview, PlayerPreview } from '../landing/landing.data';
import { ApiMatch, AvailabilityOption, ComplexOption, MatchNotice } from './match-api.model';

export function parseMatchList(value: unknown): MatchPreview[] {
  return readArray(value, 'matches', parseMatch).map(toMatchPreview);
}

export function parseMatchEnvelope(value: unknown): MatchPreview {
  return toMatchPreview(parseEnvelope(value, 'match', parseMatch));
}

export function parseMatchLeaveResult(value: unknown): { deleted: boolean } {
  if (isRecord(value) && value['deleted'] === true && !('match' in value)) return { deleted: true };
  parseMatchEnvelope(value);
  return { deleted: false };
}

export function parseComplexList(value: unknown): ComplexOption[] {
  return readArray(value, 'complexes', (item) => {
    if (!isRecord(item) || !isStringFields(item, ['id', 'name', 'address', 'zone']) || !Array.isArray(item['courts'])) {
      throw new Error('Datos de complejo inválidos');
    }
    const courts = item['courts'].map((court) => {
      if (!isRecord(court) || !isStringFields(court, ['id', 'name']) || typeof court['covered'] !== 'boolean' || typeof court['lighting'] !== 'boolean') {
        throw new Error('Datos de cancha inválidos');
      }
      return { id: court['id'] as string, name: court['name'] as string, covered: court['covered'], lighting: court['lighting'] };
    });
    return { id: item['id'] as string, name: item['name'] as string, address: item['address'] as string, zone: item['zone'] as string, courts };
  });
}

export function parseAvailability(value: unknown): Map<string, AvailabilityOption[]> {
  if (!isRecord(value) || !Array.isArray(value['courts'])) throw new Error('Disponibilidad inválida');
  const result = new Map<string, AvailabilityOption[]>();
  for (const court of value['courts']) {
    if (!isRecord(court) || typeof court['id'] !== 'string' || !Array.isArray(court['slots'])) throw new Error('Cancha inválida');
    const slots = court['slots'].map((slot): AvailabilityOption => {
      if (!isRecord(slot) || !isStringFields(slot, ['id', 'startsAt', 'endsAt', 'status']) || typeof slot['isPast'] !== 'boolean') {
        throw new Error('Turno inválido');
      }
      return { id: slot['id'] as string, startsAt: slot['startsAt'] as string, endsAt: slot['endsAt'] as string, status: slot['status'] as AvailabilityOption['status'], isPast: slot['isPast'] };
    });
    result.set(court['id'], slots);
  }
  return result;
}

export function parseNoticeList(value: unknown): MatchNotice[] {
  return readArray(value, 'notices', (item) => {
    if (!isRecord(item) || !isStringFields(item, ['id', 'matchId', 'complex', 'startsAt', 'createdAt'])) throw new Error('Aviso inválido');
    return { id: item['id'] as string, matchId: item['matchId'] as string, complex: item['complex'] as string, startsAt: item['startsAt'] as string, createdAt: item['createdAt'] as string };
  });
}

export function toMatchPreview(match: ApiMatch): MatchPreview {
  return {
    id: match.id,
    date: match.date,
    day: dayName(match.date),
    time: `${match.startsAt} hs`,
    duration: `${duration(match.startsAt, match.endsAt)} min`,
    club: match.complex,
    courtName: match.court,
    image: `/api/v1/public/courts/${encodeURIComponent(match.courtId)}/image`,
    imageAlt: `Cancha ${match.court} del complejo ${match.complex}`,
    address: match.address,
    zone: match.zone,
    level: levelsOf(match).join(' / '),
    levels: levelsOf(match),
    price: '',
    openSpots: match.missingPlayers,
    players: match.players.map(toPlayer),
    features: [match.covered ? 'Techado' : 'Aire libre', ...(match.lighting ? ['Iluminación'] : [])],
  };
}

function parseMatch(value: unknown): ApiMatch {
  const strings = ['id', 'status', 'complexId', 'complex', 'address', 'zone', 'courtId', 'court', 'date', 'startsAt', 'endsAt', 'targetLevel'];
  if (!isRecord(value) || !isStringFields(value, strings) || typeof value['covered'] !== 'boolean' || typeof value['lighting'] !== 'boolean' || !Array.isArray(value['players']) || typeof value['missingPlayers'] !== 'number') {
    throw new Error('Datos de partido inválidos');
  }
  const players = value['players'].map((item): ApiMatch['players'][number] => {
    if (!isRecord(item) || !isStringFields(item, ['name', 'level']) || typeof item['organizer'] !== 'boolean') throw new Error('Datos de jugador inválidos');
    return { name: item['name'] as string, level: item['level'] as string, position: typeof item['position'] === 'string' ? item['position'] : undefined, organizer: item['organizer'], slot: typeof item['slot'] === 'number' ? item['slot'] : undefined };
  });
  const targetLevels = Array.isArray(value['targetLevels']) ? value['targetLevels'].filter((level): level is string => typeof level === 'string') : [];
  return { ...(value as unknown as ApiMatch), targetLevels, players };
}

function toPlayer(player: ApiMatch['players'][number]): PlayerPreview {
  const initials = player.name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  const tones = ['mint', 'lavender', 'peach', 'blue'];
  const tone = tones[(initials.charCodeAt(0) + (initials.charCodeAt(1) ?? 0)) % tones.length];
  return { initials, name: player.name, level: player.level, tone, position: player.position as PlayerPreview['position'], organizer: player.organizer, slot: player.slot };
}

function levelsOf(match: ApiMatch): string[] {
  return match.targetLevels?.length ? match.targetLevels : [match.targetLevel];
}

function dayName(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
}

function duration(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return endHour * 60 + endMinute - startHour * 60 - startMinute;
}

function readArray<T>(value: unknown, key: string, parse: (item: unknown) => T): T[] {
  if (!isRecord(value) || !Array.isArray(value[key])) throw new Error('Respuesta de API inválida');
  return (value[key] as unknown[]).map(parse);
}

function parseEnvelope<T>(value: unknown, key: string, parse: (item: unknown) => T): T {
  if (!isRecord(value)) throw new Error('Respuesta de API inválida');
  return parse(value[key]);
}

function isStringFields(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
