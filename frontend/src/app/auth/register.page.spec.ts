import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RegisterPage } from './register.page';

describe('registro de jugador', () => {
  it('mantiene visible el nivel inicial antes de elegir zonas', async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#register-level')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.level-picker')).not.toBeNull();
    fixture.destroy();
  });

  it('permite varias zonas y muestra el selector de nivel al elegir una', async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const zones = fixture.nativeElement.querySelectorAll(
      'input[name="zones"]',
    ) as NodeListOf<HTMLInputElement>;

    zones[1].checked = true;
    zones[1].dispatchEvent(new Event('change'));
    zones[2].checked = true;
    zones[2].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get('zones')?.value).toEqual(['Gonnet', 'City Bell']);
    expect(fixture.nativeElement.querySelector('#register-level')).not.toBeNull();

    const level = fixture.nativeElement.querySelector('#register-level') as HTMLSelectElement;
    level.value = '7ma';
    level.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.level.value).toBe('7ma');
    fixture.destroy();
  });

  it('no muestra los textos promocionales retirados', async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const copy = fixture.nativeElement.textContent as string;
    expect(copy).not.toContain('Registro de jugador');
    expect(copy).not.toContain('En La Plata');
    expect(copy).not.toContain('Priorizaremos partidos y clubes cercanos a tus lugares de juego frecuentes.');
    expect(copy).not.toContain('Sumate a la comunidad de pádel de la ciudad.');
    expect(copy).not.toContain('Buscá partidos abiertos cerca de tu zona');
    expect(copy).not.toContain('Esta es una vista previa del frontend de HU-01.');
    fixture.destroy();
  });
});
