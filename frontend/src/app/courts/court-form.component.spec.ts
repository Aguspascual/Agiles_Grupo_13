import { TestBed } from '@angular/core/testing';
import { CourtFormComponent } from './court-form.component';
import { CourtFeatureId } from './court.model';

describe('HU-03: formulario de canchas', () => {
  async function renderForm() {
    await TestBed.configureTestingModule({ imports: [CourtFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CourtFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('rechaza nombres compuestos solo por espacios', async () => {
    const fixture = await renderForm();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    const name = fixture.nativeElement.querySelector('#court-name') as HTMLInputElement;
    name.value = '   ';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#court-name-error')).not.toBeNull();
    fixture.destroy();
  });

  it('recorta espacios y emite un solo guardado', async () => {
    const fixture = await renderForm();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    const name = fixture.nativeElement.querySelector('#court-name') as HTMLInputElement;
    name.value = '  Cancha 4  ';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      name: 'Cancha 4',
      covered: false,
      imageDataUrl: null,
      features: [],
    });
    fixture.destroy();
  });

  it('emite las características que quedaron activadas', async () => {
    const fixture = await renderForm();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    fixture.componentInstance.form.controls.name.setValue('Cancha 5');
    fixture.componentInstance.setFeature('lighting', true);
    fixture.componentInstance.setFeature('wifi', true);
    fixture.componentInstance.setFeature('lighting', false);
    fixture.componentInstance.submit();

    expect(save).toHaveBeenCalledWith({
      name: 'Cancha 5',
      covered: false,
      imageDataUrl: null,
      features: ['wifi'],
    });
    fixture.destroy();
  });

  it('lee una imagen PNG y la conserva en el borrador', async () => {
    const fixture = await renderForm();
    const image = new File(['foto'], 'cancha.png', { type: 'image/png' });
    await fixture.componentInstance.onImageSelected({
      target: { files: [image] },
    } as unknown as Event);

    expect(fixture.componentInstance.form.controls.imageDataUrl.value).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(fixture.componentInstance.imageError).toBe('');
    fixture.destroy();
  });

  it('rechaza imágenes con formato no permitido o mayores a 5 MB', async () => {
    const fixture = await renderForm();
    const component = fixture.componentInstance;
    await component.onImageSelected({
      target: { files: [new File(['texto'], 'cancha.txt', { type: 'text/plain' })] },
    } as unknown as Event);
    expect(component.form.controls.imageDataUrl.value).toBeNull();
    expect(component.imageError).toContain('PNG, JPG o WebP');

    component.clearImage();
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', {
      type: 'image/png',
    });
    await component.onImageSelected({ target: { files: [oversized] } } as unknown as Event);
    expect(component.form.controls.imageDataUrl.value).toBeNull();
    expect(component.imageError).toContain('5 MB');
    fixture.destroy();
  });

  it('carga y deja quitar la imagen y las características actuales al editar', async () => {
    const fixture = await renderForm();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    fixture.componentRef.setInput('court', {
      id: 'court-1',
      complexId: 'complex-gonnet',
      name: 'Cancha 1',
      covered: true,
      hasFutureReservations: false,
      imageDataUrl: 'data:image/webp;base64,dGVzdA==',
      features: ['lighting', 'acrylicSurface'] as CourtFeatureId[],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.imageDataUrl.value).toContain('image/webp');
    expect(fixture.componentInstance.form.controls.features.value).toEqual([
      'lighting',
      'acrylicSurface',
    ]);
    fixture.componentInstance.clearImage();
    fixture.componentInstance.setFeature('acrylicSurface', false);
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.form.controls.imageDataUrl.value).toBeNull();
    expect(fixture.componentInstance.form.controls.features.value).toEqual(['lighting']);
    expect(save).toHaveBeenCalledWith({
      name: 'Cancha 1',
      covered: true,
      imageDataUrl: null,
      features: ['lighting'],
    });
    fixture.destroy();
  });
});
