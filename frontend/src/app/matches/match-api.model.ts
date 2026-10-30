export interface ApiPlayer {
  name: string;
  level: string;
  position?: string;
  organizer: boolean;
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

export interface MatchCreateRequest {
  date: string;
  startsAt: string;
  targetLevel: string;
}
