import { TestBed } from '@angular/core/testing';
import { ComplexCardComponent } from './complex-card.component';
import { ComplexRecord } from './complex.model';

describe('tarjeta de complejo', () => {
  const complex = {
    id: 'complex-1',
    name: 'Club Norte',
    address: 'Calle 1',
    phone: '221 555 0000',
    zone: 'Gonnet',
    imageDataUrl: 'data:image/png;base64,AAAA',
    managerIds: [],
  } as unknown as ComplexRecord;

  async function render(record: ComplexRecord) {
    await TestBed.configureTestingModule({ imports: [ComplexCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ComplexCardComponent);
    fixture.componentRef.setInput('complex', record);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra la imagen y el nombre, y no los demás datos', async () => {
    const fixture = await render(complex);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('img')?.getAttribute('alt')).toBe('Imagen de Club Norte');
    expect(root.querySelector('.card-title')?.textContent).toContain('Club Norte');
    expect(root.textContent).not.toContain('Calle 1');
    expect(root.querySelector('.card-actions')).toBeNull();
    fixture.destroy();
  });

  it('usa un ícono cuando el complejo no tiene imagen', async () => {
    const fixture = await render({ ...complex, imageDataUrl: null });

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.court-mark')).not.toBeNull();
    fixture.destroy();
  });

  it('emite el complejo al presionar la tarjeta', async () => {
    const fixture = await render(complex);
    let opened: ComplexRecord | undefined;
    fixture.componentInstance.open.subscribe((value) => (opened = value));

    (fixture.nativeElement.querySelector('button.complex-card') as HTMLButtonElement).click();

    expect(opened).toBe(complex);
    fixture.destroy();
  });
});