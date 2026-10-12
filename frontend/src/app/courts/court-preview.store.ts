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
