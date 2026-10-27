import { Injectable, signal } from '@angular/core';
import { CourtDraft, CourtRecord } from './court.model';

@Injectable({ providedIn: 'root' })
export class CourtPreviewStore {
  readonly courts = signal<CourtRecord[]>([
    {
      id: 'court-gonnet-1',
      complexId: 'complex-gonnet',
      name: 'Cancha 1',
      covered: true,
      hasFutureReservations: false,
      imageDataUrl: null,
      features: [],
    },
    {
      id: 'court-gonnet-2',
      complexId: 'complex-gonnet',
      name: 'Cancha 2',
      covered: false,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting', 'wifi'],
    },
    {
      id: 'court-centro-1',
      complexId: 'complex-centro',
      name: 'Cancha 1',
      covered: false,
      hasFutureReservations: false,
      imageDataUrl: null,
      features: ['electronicScoreboard'],
    },
    // HU-05: canchas de los clubes del directorio público.
    {
      id: 'court-cumbre-1',
      complexId: 'complex-cumbre',
      name: 'Cancha 1',
      covered: true,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting', 'acrylicSurface'],
    },
    {
      id: 'court-cumbre-2',
      complexId: 'complex-cumbre',
      name: 'Cancha 2',
      covered: true,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting'],
    },
    {
      id: 'court-cumbre-3',
      complexId: 'complex-cumbre',
      name: 'Cancha 3',
      covered: false,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting', 'electronicScoreboard'],
    },
    {
      id: 'court-citybell-1',
      complexId: 'complex-citybell',
      name: 'Cancha 1',
      covered: false,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting', 'wifi'],
    },
    {
      id: 'court-citybell-2',
      complexId: 'complex-citybell',
      name: 'Cancha 2',
      covered: false,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting'],
    },
    {
      id: 'court-estudiantes-1',
      complexId: 'complex-estudiantes',
      name: 'Cancha Central',
      covered: true,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting', 'electronicScoreboard', 'acrylicSurface'],
    },
    {
      id: 'court-estudiantes-2',
      complexId: 'complex-estudiantes',
      name: 'Cancha 2',
      covered: false,
      hasFutureReservations: true,
      imageDataUrl: null,
      features: ['lighting'],
    },
  ]);

  forComplex(complexId: string): CourtRecord[] {
    return this.courts().filter((court) => court.complexId === complexId);
  }

  create(complexId: string, draft: CourtDraft): void {
    this.courts.update((courts) => [
      ...courts,
      {
        ...draft,
        imageDataUrl: draft.imageDataUrl ?? null,
        features: [...(draft.features ?? [])],
        id: crypto.randomUUID(),
        complexId,
        hasFutureReservations: false,
      },
    ]);
  }

  update(id: string, draft: CourtDraft): void {
    this.courts.update((courts) =>
      courts.map((court) =>
        court.id === id
          ? {
              ...court,
              ...draft,
              imageDataUrl:
                draft.imageDataUrl === undefined ? court.imageDataUrl : draft.imageDataUrl,
              features: [...(draft.features ?? court.features)],
            }
          : court,
      ),
    );
  }

  remove(id: string): boolean {
    const target = this.courts().find((court) => court.id === id);
    if (!target || target.hasFutureReservations) return false;
    this.courts.update((courts) => courts.filter((court) => court.id !== id));
    return true;
  }
}
