import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthTokenStore } from './auth-token.store';
import { LoginPage } from './login.page';

describe('login page con autenticación HTTP', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('inicia sesión con acceso a complejos, persiste el JWT y navega a administración', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.form.setValue({
      email: 'ana@example.com',
      password: 'password-123',
      remember: false,
    });

    fixture.componentInstance.onSubmit();
    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.body).toEqual({ email: 'ana@example.com', password: 'password-123' });
    req.flush({
      user: { id: 'u1', name: 'Ana', email: 'ana@example.com', zone: 'Gonnet', level: '7ma' },
      token: 'jwt-token',
    });
    http.expectOne('/api/v1/complexes').flush({ complexes: [] });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBe('jwt-token');
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/admin/complejos');
  });

  it('envía al inicio de jugador cuando la API indica que no tiene acceso administrativo', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.form.setValue({ email: 'jugador@example.com', password: 'password-123', remember: true });

    fixture.componentInstance.onSubmit();
    http.expectOne('/api/v1/auth/login').flush({
      user: { id: 'u2', name: 'Jugador', email: 'jugador@example.com', zone: 'Gonnet', level: '7ma' },
      token: 'player-token',
    });
    http.expectOne('/api/v1/complexes').flush(
      { error: 'sin permisos para gestionar complejos' },
      { status: 403, statusText: 'Forbidden' },
    );

    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('muestra un mensaje genérico ante credenciales incorrectas y permite reintentar', () => {
    fixture.componentInstance.form.setValue({
      email: 'ana@example.com',
      password: 'incorrecta',
      remember: true,
    });
    fixture.componentInstance.onSubmit();
    http.expectOne('/api/v1/auth/login').flush(
      { error: 'email o contraseña incorrectos' },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'El correo o la contraseña no son correctos.',
    );
    expect(fixture.componentInstance.requestInProgress).toBe(false);
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
  });

  it('no envía remember y bloquea el envío durante una petición', () => {
    fixture.componentInstance.form.setValue({
      email: 'ana@example.com',
      password: 'password-123',
      remember: true,
    });
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();

    const requests = http.match('/api/v1/auth/login');
    expect(requests).toHaveLength(1);
    requests[0].flush(
      { error: 'fallo interno' },
      { status: 500, statusText: 'Server Error' },
    );
  });
});
