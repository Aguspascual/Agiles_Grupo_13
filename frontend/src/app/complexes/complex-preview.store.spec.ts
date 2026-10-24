import { ComplexPreviewStore } from './complex-preview.store';

describe('HU-02: vista previa de complejos', () => {
  it('limita la vista simulada del encargado a complejos asignados', () => {
    const store = new ComplexPreviewStore();

    expect(store.forActor('manager', 'manager-ana').map(complex => complex.id)).toEqual(['complex-gonnet']);
    expect(store.forActor('admin', 'manager-ana')).toHaveLength(5);
  });

  it('permite alta, edición y baja locales sin servidor', () => {
    const store = new ComplexPreviewStore();
    const draft = {
      name: 'Pádel de prueba',
      address: 'Calle 10 123',
      zone: 'Casco Urbano',
      phone: '221 555-0000',
      managerIds: ['manager-ana'],
    };

    store.create(draft);
    const created = store.complexes().find(complex => complex.name === draft.name);
    expect(created).toBeDefined();
    if (!created) return;

    store.update(created.id, { ...draft, name: 'Pádel actualizado' });
    expect(store.complexes().find(complex => complex.id === created.id)?.name).toBe('Pádel actualizado');

    store.remove(created.id);
    expect(store.complexes().some(complex => complex.id === created.id)).toBe(false);
  });
});
