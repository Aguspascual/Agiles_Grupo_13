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
  imageDataUrl: string | null;
  features: CourtFeatureId[];
}

export type CourtDraft = Omit<CourtRecord, 'id' | 'complexId'>;
