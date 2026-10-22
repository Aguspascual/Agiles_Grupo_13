import { CourtPreviewStore } from './court-preview.store';
import { CourtFeatureId } from './court.model';

describe('HU-03: vista previa de canchas', () => {
  it('filtra canchas por complejo', () => {
    const store = new CourtPreviewStore();

    expect(
      store.forComplex('complex-gonnet').every((court) => court.complexId === 'complex-gonnet'),
    ).toBe(true);
    expect(
      store.forComplex('complex-centro').every((court) => court.complexId === 'complex-centro'),
    ).toBe(true);
  });

  it('permite crear y editar canchas en la vista local', () => {
    const store = new CourtPreviewStore();
    const draft = {
      name: 'Cancha de prueba',
      covered: true,
      imageDataUrl: 'data:image/png;base64,Y2FuY2hh',
      features: ['lighting', 'wifi'] as CourtFeatureId[],
    };

    store.create('complex-gonnet', draft);
    const created = store.forComplex('complex-gonnet').find((court) => court.name === draft.name);
    expect(created).toBeDefined();
    if (!created) return;

    store.update(created.id, {
      ...draft,
      name: 'Cancha renovada',
      covered: false,
      imageDataUrl: null,
      features: ['acrylicSurface'],
    });
    expect(
      store.forComplex('complex-gonnet').find((court) => court.id === created.id),
    ).toMatchObject({
      name: 'Cancha renovada',
      covered: false,
      imageDataUrl: null,
      features: ['acrylicSurface'],
    });
    expect(
      store.forComplex('complex-gonnet').find((court) => court.id !== created.id),
    ).toMatchObject({
      id: 'court-gonnet-1',
      imageDataUrl: null,
      features: [],
    });
  });

  it('permite dar de baja canchas sin reservas futuras', () => {
    const store = new CourtPreviewStore();
    const court = store.forComplex('complex-gonnet').find((item) => !item.hasFutureReservations);
    expect(court).toBeDefined();
    if (!court) return;

    expect(store.remove(court.id)).toBe(true);
    expect(store.forComplex('complex-gonnet').some((item) => item.id === court.id)).toBe(false);
  });

  it('bloquea la baja de canchas con reservas futuras', () => {
    const store = new CourtPreviewStore();
    const reserved = store.forComplex('complex-gonnet').find((item) => item.hasFutureReservations);
    expect(reserved).toBeDefined();
    if (!reserved) return;

    expect(store.remove(reserved.id)).toBe(false);
    expect(store.forComplex('complex-gonnet').some((item) => item.id === reserved.id)).toBe(true);
  });
});
