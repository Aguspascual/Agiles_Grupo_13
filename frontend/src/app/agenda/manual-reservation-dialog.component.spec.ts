import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManualContact, ManualReservationDialogComponent } from './manual-reservation-dialog.component';

describe('HU-15: diálogo de reserva manual', () => {
  let fixture: ComponentFixture<ManualReservationDialogComponent>;
  let saved: ManualContact[];
  let closed: number;

  const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;
  const type = (selector: string, value: string) => {
    const input = el(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ManualReservationDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(ManualReservationDialogComponent);
    fixture.componentRef.setInput('courtName', 'Cancha 2');
    fixture.componentRef.setInput('dateLabel', 'Lunes 2 de noviembre');
    fixture.componentRef.setInput('startsAt', '19:30');
    fixture.componentRef.setInput('endsAt', '21:00');
    saved = [];
    closed = 0;
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.close.subscribe(() => closed++);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('muestra cancha, fecha y horario del turno elegido', () => {
    const text = el('.summary').textContent ?? '';
    expect(text).toContain('Cancha 2');
    expect(text).toContain('Lunes 2 de noviembre');
    expect(text).toContain('19:30 a 21:00');
  });

  it('exige nombre y teléfono sin aceptar solo espacios', () => {
    type('#manual-name', '   ');
    type('#manual-phone', '');
    el('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(saved).toEqual([]);
    expect(el('#manual-name-error')).not.toBeNull();
    expect(el('#manual-phone-error')).not.toBeNull();
  });

  it('emite nombre y teléfono recortados, sin validar un formato telefónico', () => {
    type('#manual-name', '  Luis Gómez ');
    type('#manual-phone', ' 221-555 0102 (tarde) ');
    el('form').dispatchEvent(new Event('submit'));

    expect(saved).toEqual([{ name: 'Luis Gómez', phone: '221-555 0102 (tarde)' }]);
  });

  it('no envía dos veces mientras guarda', () => {
    type('#manual-name', 'Luis');
    type('#manual-phone', '123');
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    el('form').dispatchEvent(new Event('submit'));

    expect(saved).toEqual([]);
    expect((el('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('se cierra con Escape y con Volver', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (el('.secondary') as HTMLButtonElement).click();
    expect(closed).toBe(2);
  });
});
