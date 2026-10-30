import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { AuthSessionService } from './auth/auth-session.service';
import { AuthTokenStore } from './auth/auth-token.store';

describe('HU-01: registro e inicio de sesión', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  async function open(path: string): Promise<{ root: HTMLElement; fixture: ComponentFixture<App> }> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(path);
    await fixture.whenStable();
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, fixture };
  }

  function fill(root: HTMLElement, name: string, value: string): void {
    const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('muestra el acceso a la cuenta desde la ruta de ingreso', async () => {
    const { root } = await open('/ingresar');
    expect(root.textContent).toContain('Volvé a la cancha');
    expect(root.textContent).not.toContain('Ingresá a tu cuenta para sumarte a partidos abiertos');
    expect(root.querySelector('input[name="email"]')).not.toBeNull();
    expect(root.querySelector('input[name="password"]')).not.toBeNull();
    expect(root.querySelector('a[href="/registro"]')).not.toBeNull();
  });

  it('redirige las rutas de administración a ingreso si no hay sesión válida', async () => {
    const { root } = await open('/admin/complejos');
    expect(TestBed.inject(Router).url).toBe('/ingresar');
    expect(root.querySelector('.login-page')).not.toBeNull();
  });

  it('mantiene disponible la ruta /perfil integrada por HU-08', async () => {
    const { root, fixture } = await open('/perfil');

    expect(TestBed.inject(Router).url).toBe('/perfil');
    expect(root.textContent).toContain('Foto de perfil e identidad');
    fixture.destroy();
  });

  it('valida el token persistido al recargar mediante GET /me', async () => {
    sessionStorage.setItem(AuthTokenStore.storageKey, 'saved-jwt');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer saved-jwt');
    request.flush({
      user: { id: 'u1', name: 'Ana', email: 'ana@example.com', zone: 'Gonnet', level: '7ma' },
    });
    await fixture.whenStable();
    expect(TestBed.inject(AuthSessionService).currentUser()).toEqual({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      zone: 'Gonnet',
      level: '7ma',
    });
    fixture.destroy();
  });

  it('marca los campos vacíos y no simula una sesión', async () => {
    const { root, fixture } = await open('/ingresar');
    const form = root.querySelector('form');
    expect(form).not.toBeNull();
    if (!form) return;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(root.textContent).toContain('Ingresá tu correo electrónico');
    expect(root.textContent).toContain('Ingresá tu contraseña');
    expect(root.textContent).not.toContain('Formulario listo para conectar');
  });

  it('inicia sesión como jugador mediante la API y vuelve al inicio', async () => {
    const { root, fixture } = await open('/ingresar');
    fill(root, 'email', 'jugadora@example.com');
    fill(root, 'password', 'claveSegura123');
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ email: 'jugadora@example.com', password: 'claveSegura123' });
    request.flush({
      user: { id: 'u1', name: 'Jugadora', email: 'jugadora@example.com', zone: 'Gonnet', level: '7ma' },
      token: 'jwt-test',
    });
    TestBed.inject(HttpTestingController).expectOne('/api/v1/complexes').flush(
      { error: 'sin permisos para gestionar complejos' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBe('jwt-test');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(root.querySelector('.login-page')).toBeNull();
  });

  it('rechaza contraseñas distintas en el registro', async () => {
    const { root, fixture } = await open('/registro');
    fill(root, 'name', 'Ana Pérez');
    fill(root, 'email', 'ana@example.com');
    fill(root, 'password', 'claveSegura123');
    fill(root, 'confirmPassword', 'otraClave123');
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(root.textContent).toContain('Las contraseñas no coinciden');
    expect(root.textContent).not.toContain('Formulario listo para conectar');
  });
});
