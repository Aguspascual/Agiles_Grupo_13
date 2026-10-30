import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthTokenStore } from './auth-token.store';
import { authInterceptor } from './auth.interceptor';
import { AuthFlashStore } from './auth-flash.store';
import { RegisterPage } from './register.page';

describe('registro de jugador HU-01', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<RegisterPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  function fillValidForm(): void {
    fixture.componentInstance.form.setValue({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'password-123',
      confirmPassword: 'password-123',
      zones: ['Gonnet'],
      level: '7ma',
      position: 'Drive',
      hand: 'Diestro',
      fairPlay: true,
    });
    fixture.detectChanges();
  }

  it('requiere al menos una zona y conserva disponible el nivel inicial', () => {
    expect(fixture.componentInstance.form.controls.zones.value).toEqual([]);
    expect(fixture.componentInstance.form.controls.zones.hasError('required')).toBe(true);
    expect(fixture.nativeElement.querySelector('#register-level')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('input[name="zone"]')).toHaveLength(7);
  });

  it('permite elegir varias zonas y quitar una sin perder las demás', () => {
    const zones = fixture.nativeElement.querySelectorAll(
      'input[name="zone"]',
    ) as NodeListOf<HTMLInputElement>;

    zones[1].click();
    zones[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.zones.value).toEqual(['Gonnet', 'City Bell']);

    zones[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.zones.value).toEqual(['City Bell']);
    expect(zones[2].checked).toBe(true);
  });

  it('exige posición y mano hábil', () => {
    fillValidForm();
    fixture.componentInstance.form.patchValue({ position: '', hand: '' });
    fixture.componentInstance.onSubmit();
    expect(http.match('/api/v1/auth/register')).toHaveLength(0);
    expect(fixture.componentInstance.form.controls.position.hasError('required')).toBe(true);
    expect(fixture.componentInstance.form.controls.hand.hasError('required')).toBe(true);
  });

  it('elige el nivel desde el menú desplegable propio', () => {
    const trigger = fixture.nativeElement.querySelector('#register-level') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    const options = fixture.nativeElement.querySelectorAll('.level-menu [role="option"]') as NodeListOf<HTMLElement>;
    expect(options).toHaveLength(9);

    options[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.level.value).toBe('6ta');
    expect(fixture.nativeElement.querySelector('.level-menu')).toBeNull();
  });
  it('no envía el formulario si faltan datos o las contraseñas no coinciden', () => {
    fixture.componentInstance.form.patchValue({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'password-123',
      confirmPassword: 'otra-password',
      zones: ['Gonnet'],
      level: '7ma',
      fairPlay: true,
    });
    fixture.componentInstance.onSubmit();
    expect(http.match('/api/v1/auth/register')).toHaveLength(0);
    expect(fixture.componentInstance.form.hasError('passwordMismatch')).toBe(true);
  });

  it('envía el DTO exacto, no inicia sesión y lleva al login con un aviso', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fillValidForm();

    fixture.componentInstance.onSubmit();
    const request = http.expectOne('/api/v1/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'password-123',
      zone: 'Gonnet',
      level: '7ma',
      position: 'Drive',
      hand: 'Diestro',
      fairPlay: true,
    });
    expect(typeof request.request.body.zone).toBe('string');
    expect(Object.keys(request.request.body).sort()).toEqual(
      ['email', 'fairPlay', 'hand', 'level', 'name', 'password', 'position', 'zone'].sort(),
    );
    request.flush({
      user: { id: 'user-1', name: 'Ana Pérez', email: 'ana@example.com', zone: 'Gonnet', level: '7ma' },
      token: 'registered-jwt',
    }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/ingresar'], {});
    expect(TestBed.inject(AuthFlashStore).take()).toContain('Cuenta creada con éxito');
    expect(fixture.componentInstance.requestInProgress).toBe(false);
  });

  it('muestra un error de validación legible para HTTP 400', () => {
    fillValidForm();
    fixture.componentInstance.onSubmit();
    http.expectOne('/api/v1/auth/register').flush(
      { error: 'zone inválida' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Revisá los datos del formulario',
    );
    expect(fixture.componentInstance.requestInProgress).toBe(false);
  });

  it('explica el conflicto de correo duplicado HTTP 409', () => {
    fillValidForm();
    fixture.componentInstance.onSubmit();
    http.expectOne('/api/v1/auth/register').flush(
      { error: 'el email ya está registrado' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya existe una cuenta con ese correo electrónico.',
    );
    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(fixture.componentInstance.form.controls.email.hasError('emailTaken')).toBe(true);
    expect(fixture.nativeElement.querySelector('.form-error')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Ya existe una cuenta con ese correo electrónico. Iniciá sesión');

    fixture.componentInstance.form.controls.email.setValue('otra@example.com');
    expect(fixture.componentInstance.form.controls.email.hasError('emailTaken')).toBe(false);
  });

  it('muestra un error recuperable para HTTP 500 y permite reintentar', () => {
    fillValidForm();
    fixture.componentInstance.onSubmit();
    http.expectOne('/api/v1/auth/register').flush(
      { error: 'fallo interno' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos crear tu cuenta',
    );
    expect(fixture.componentInstance.requestInProgress).toBe(false);
  });

  it('informa problemas de red y no duplica envíos mientras espera', () => {
    fillValidForm();
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();
    const requests = http.match('/api/v1/auth/register');
    expect(requests).toHaveLength(1);
    requests[0].error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos conectar con el servicio',
    );
    expect(fixture.componentInstance.requestInProgress).toBe(false);
  });

  it('no muestra los textos promocionales retirados', () => {
    const copy = fixture.nativeElement.textContent as string;
    expect(copy).not.toContain('Registro de jugador');
    expect(copy).not.toContain('En La Plata');
    expect(copy).not.toContain('Priorizaremos partidos y clubes cercanos a tus lugares de juego frecuentes.');
    expect(copy).not.toContain('Sumate a la comunidad de pádel de la ciudad.');
    expect(copy).not.toContain('Buscá partidos abiertos cerca de tu zona');
    expect(copy).not.toContain('Esta es una vista previa del frontend de HU-01.');
  });
});
