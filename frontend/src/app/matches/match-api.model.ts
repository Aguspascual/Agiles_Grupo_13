export interface ApiPlayer {
  name: string;
  level: string;
  position?: string;
  organizer: boolean;
  /** Lugar en la cancha: 1 y 2 son la pareja A, 3 y 4 la pareja B. */
  slot?: number;
}

export interface ApiMatch {
  id: string;
  status: 'open' | 'full';
  complexId: string;
  complex: string;
  address: string;
  zone: string;
  courtId: string;
  court: string;
  covered: boolean;
  lighting: boolean;
  date: string;
  startsAt: string;
  endsAt: string;
  targetLevel: string;
  targetLevels?: string[];
  players: ApiPlayer[];
  missingPlayers: number;
}

export interface CourtOption {
  id: string;
  name: string;
  covered: boolean;
  lighting: boolean;
}

export interface ComplexOption {
  id: string;
  name: string;
  address: string;
  zone: string;
  courts: CourtOption[];
}

export interface AvailabilityOption {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'AVAILABLE' | 'RESERVED' | 'BLOCKED';
  isPast: boolean;
}

export interface MatchNotice {
  id: string;
  matchId: string;
  complex: string;
  startsAt: string;
  createdAt: string;
}

export interface MatchLeaveResult {
  deleted: boolean;
}

export interface MatchCreateRequest {
  date: string;
  startsAt: string;
  targetLevel: string;
  /** Hasta tres niveles buscados; el primero es el principal. */
  targetLevels: string[];
  /** Lugar elegido en la cancha (1 a 4). */
  slot?: number;
}
