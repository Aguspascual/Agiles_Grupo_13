import { TestBed } from '@angular/core/testing';
import { ComplexFormComponent } from './complex-form.component';

describe('imagen del complejo', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [ComplexFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ComplexFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('permite seleccionar la imagen del club y la incluye en el borrador', async () => {
    const fixture = await render();
    const selected = new File(['foto'], 'club.png', { type: 'image/png' });
    await fixture.componentInstance.onImageSelected({ target: { files: [selected] } } as unknown as Event);

    expect(fixture.componentInstance.form.controls.imageDataUrl.value).toMatch(/^data:image\/png;base64,/);
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    fixture.componentInstance.form.patchValue({
      name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221', managerIds: ['manager'],
      pricing: { turnPrice: '1000.00', depositEnabled: false, depositType: 'fixed', depositValue: '' },
    });
    fixture.componentInstance.submit();

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ imageDataUrl: expect.stringContaining('data:image/png;base64,') }));
    fixture.destroy();
  });

  it('carga la imagen existente al editar y permite quitarla', async () => {
    const fixture = await render();
    fixture.componentRef.setInput('complex', {
      id: 'complex-1', name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221', managerIds: [],
      imageDataUrl: 'data:image/png;base64,dGVzdA==',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.imageDataUrl.value).toContain('image/png');
    fixture.componentInstance.clearImage();
    expect(fixture.componentInstance.form.controls.imageDataUrl.value).toBeNull();
    fixture.destroy();
  });

  it('rechaza formatos no permitidos e imágenes mayores a 5 MB', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    await component.onImageSelected({ target: { files: [new File(['texto'], 'club.txt', { type: 'text/plain' })] } } as unknown as Event);
    expect(component.form.controls.imageDataUrl.value).toBeNull();
    expect(component.imageError).toContain('PNG, JPG o WebP');

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
    await component.onImageSelected({ target: { files: [oversized] } } as unknown as Event);
    expect(component.form.controls.imageDataUrl.value).toBeNull();
    expect(component.imageError).toContain('5 MB');
    fixture.destroy();
  });
});

describe('encargados del complejo', () => {
  const admins = [{ id: 'admin-1', name: 'Ana Admin', email: 'ana@example.com' }, { id: 'admin-2', name: 'Beto Admin', email: 'beto@example.com' }];

  async function render(managerIds: string[]) {
    await TestBed.configureTestingModule({ imports: [ComplexFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ComplexFormComponent);
    fixture.componentRef.setInput('managers', admins);
    fixture.componentRef.setInput('complex', {
      id: 'c1', name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221', imageDataUrl: null, managerIds,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('ofrece solo la lista recibida (administradores) y descarta encargados que ya no son válidos', async () => {
    const fixture = await render(['admin-1', 'jugador-1']);

    expect(fixture.componentInstance.form.controls.managerIds.value).toEqual(['admin-1']);
    expect(fixture.componentInstance.managerOptions.map((option) => option.label)).toEqual(['Ana Admin', 'Beto Admin']);
    fixture.destroy();
  });

  it('permite elegir varios encargados y exige al menos uno', async () => {
    const fixture = await render(['admin-1']);
    fixture.componentInstance.setManagers(['admin-1', 'admin-2']);
    expect(fixture.componentInstance.form.controls.managerIds.value).toEqual(['admin-1', 'admin-2']);

    fixture.componentInstance.setManagers([]);
    expect(fixture.componentInstance.form.controls.managerIds.invalid).toBe(true);
    fixture.destroy();
  });

  it('muestra nombre y dirección en la misma fila', async () => {
    const fixture = await render(['admin-1']);
    const fields = [...fixture.nativeElement.querySelectorAll('.field-grid > .field')] as HTMLElement[];

    expect(fields.slice(0, 2).map((field) => field.classList.contains('wide'))).toEqual([false, false]);
    expect(fields[0].textContent).toContain('Nombre del complejo');
    expect(fields[1].textContent).toContain('Dirección');
    fixture.destroy();
  });
});

describe('configuración de precio y seña del complejo (HU-21)', () => {
  it('ofrece campos para precio del turno y activar la seña', async () => {
    await TestBed.configureTestingModule({ imports: [ComplexFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ComplexFormComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#turn-price')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#deposit-enabled')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ARS');
    fixture.destroy();
  });

  it('permite editar un complejo legado sin precio y omite pricing mientras la seña siga apagada', async () => {
    await TestBed.configureTestingModule({ imports: [ComplexFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ComplexFormComponent);
    fixture.componentRef.setInput('complex', {
      id: 'legacy', name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221', imageDataUrl: null,
      managerIds: ['admin'], pricing: { turnPrice: '0.00', depositEnabled: false, depositType: 'fixed', depositValue: '0.00' },
    });
    fixture.detectChanges();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    fixture.componentInstance.form.controls.name.setValue('Club actualizado');

    expect(fixture.componentInstance.form.controls.pricing.errors).toBeNull();
    expect(fixture.componentInstance.form.valid).toBe(true);
    fixture.componentInstance.submit();

    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].name).toBe('Club actualizado');
    expect(save.mock.calls[0][0]).not.toHaveProperty('pricing');
    fixture.destroy();
  });

  it('valida precio y modalidades de seña antes de emitir el borrador', async () => {
    await TestBed.configureTestingModule({ imports: [ComplexFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ComplexFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const save = vi.fn();
    component.save.subscribe(save);
    component.form.patchValue({ name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221', managerIds: ['admin'] });
    component.form.controls.pricing.patchValue({ turnPrice: '0', depositEnabled: false, depositType: 'fixed', depositValue: '' });
    component.submit();
    expect(save).not.toHaveBeenCalled();

    component.form.controls.pricing.patchValue({ turnPrice: '1500.50', depositEnabled: true, depositType: 'fixed', depositValue: '1500.51' });
    component.submit();
    expect(save).not.toHaveBeenCalled();

    component.form.controls.pricing.patchValue({ turnPrice: '1500.50', depositEnabled: true, depositType: 'percentage', depositValue: '100.01' });
    component.submit();
    expect(save).not.toHaveBeenCalled();

    component.form.controls.pricing.patchValue({ turnPrice: '1500.50', depositEnabled: true, depositType: 'percentage', depositValue: '100.00' });
    component.submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ pricing: expect.objectContaining({ turnPrice: '1500.50', depositValue: '100.00' }) }));
    fixture.destroy();
  });
});
