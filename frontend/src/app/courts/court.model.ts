export const COURT_FEATURES = [
  { id: 'lighting', label: 'Iluminación' },
  { id: 'electronicScoreboard', label: 'Tablero electrónico' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'acrylicSurface', label: 'Superficie acrílica' },
] as const;

export type CourtFeatureId = (typeof COURT_FEATURES)[number]['id'];

export interface CourtRecord {
  id: string;
  complexId: string;
  name: string;
  covered: boolean;
  hasFutureReservations: boolean;
  imageDataUrl: string | null;
  features: CourtFeatureId[];
}

export type CourtDraft = Pick<CourtRecord, 'name' | 'covered'> &
  Partial<Pick<CourtRecord, 'imageDataUrl' | 'features'>>;
