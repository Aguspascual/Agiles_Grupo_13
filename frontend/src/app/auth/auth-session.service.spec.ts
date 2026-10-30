import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from './auth-session.service';
import { AuthTokenStore } from './auth-token.store';
import { authInterceptor } from './auth.interceptor';
import { AuthResponse, AuthUser } from './auth.model';

const user: AuthUser = {
  id: 'user-1',
  name: 'Ana Pérez',
  email: 'ana@example.com',
  zone: 'Gonnet',
  level: '7ma',
};

describe('AuthSessionService', () => {
  let session: AuthSessionService;
  let tokens: AuthTokenStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    session = TestBed.inject(AuthSessionService);
    tokens = TestBed.inject(AuthTokenStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persiste el JWT según Recordarme y no guarda otros datos sensibles', () => {
    const response: AuthResponse = { user, token: 'jwt-token' };

    session.accept(response, false);
    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBe('jwt-token');
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(session.currentUser()).toEqual(user);

    session.accept({ ...response, token: 'remembered-token' }, true);
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBe('remembered-token');
    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(localStorage.getItem('password')).toBeNull();
  });

  it('recupera el usuario desde /me al restaurar un token guardado', () => {
    tokens.save('jwt-token', false);
    let result: AuthUser | null | undefined;

    session.restore().subscribe((value) => (result = value));

    const req = http.expectOne('/api/v1/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({ user });
    expect(result).toEqual(user);
    expect(session.currentUser()).toEqual(user);
  });

  it('limpia una sesión con token inválido o vencido (401)', () => {
    tokens.save('expired-token', true);
    let result: AuthUser | null | undefined;

    session.restore().subscribe((value) => (result = value));

    http.expectOne('/api/v1/auth/me').flush({ error: 'no autorizado' }, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBeNull();
    expect(tokens.token()).toBeNull();
    expect(session.currentUser()).toBeNull();
  });

  it('no descarta el JWT ante un fallo temporal distinto de 401', () => {
    tokens.save('jwt-token', false);

    session.restore().subscribe({ error: () => undefined });

    http.expectOne('/api/v1/auth/me').flush({ error: 'fallo interno' }, { status: 500, statusText: 'Server Error' });
    expect(tokens.token()).toBe('jwt-token');
    expect(session.currentUser()).toBeNull();
  });

  it('no llama /me cuando no hay token almacenado', () => {
    let result: AuthUser | null | undefined;
    session.restore().subscribe((value) => (result = value));

    http.expectNone('/api/v1/auth/me');
    expect(result).toBeNull();
  });

  it('limpia token y usuario cuando una API protegida responde 401', () => {
    session.accept({ user, token: 'jwt-token' }, true);
    let requestError: unknown;

    TestBed.inject(HttpClient).get('/api/v1/protected').subscribe({
      error: (error: unknown) => (requestError = error),
    });
    const request = http.expectOne('/api/v1/protected');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    request.flush({ error: 'no autorizado' }, { status: 401, statusText: 'Unauthorized' });

    expect(requestError).toBeDefined();
    expect(session.token).toBeNull();
    expect(session.currentUser()).toBeNull();
    expect(session.authenticated()).toBe(false);
  });

  for (const status of [200, 401]) {
    it(`conserva la sesión nueva si la restauración anterior devuelve ${status}`, () => {
      tokens.save('old-token', false);
      let restored: AuthUser | null | undefined;
      session.restore().subscribe((value) => (restored = value));
      const pending = http.expectOne('/api/v1/auth/me');
      expect(pending.request.headers.get('Authorization')).toBe('Bearer old-token');

      const newUser = { ...user, id: 'user-2', email: 'new@example.com' };
      session.login({ email: newUser.email, password: 'valid-password' }, false).subscribe();
      http.expectOne('/api/v1/auth/login').flush({ user: newUser, token: 'new-token' });

      if (status === 200) pending.flush({ user });
      else pending.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

      expect(session.token).toBe('new-token');
      expect(session.currentUser()).toEqual(newUser);
      expect(restored).toEqual(newUser);
      expect(session.authenticated()).toBe(true);
      expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBe('new-token');
    });
  }

  it('ignora un 401 de una petición protegida con el token anterior', () => {
    session.accept({ user, token: 'old-token' }, true);
    let requestError: unknown;
    TestBed.inject(HttpClient).get('/api/v1/protected').subscribe({
      error: (error: unknown) => (requestError = error),
    });
    const pending = http.expectOne('/api/v1/protected');
    const newUser = { ...user, id: 'user-2', email: 'new@example.com' };
    session.accept({ user: newUser, token: 'new-token' }, true);
    pending.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(requestError).toBeDefined();
    expect(session.token).toBe('new-token');
    expect(session.currentUser()).toEqual(newUser);
    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBe('new-token');
  });

  it('no restaura el usuario anterior después de cerrar sesión', () => {
    tokens.save('old-token', false);
    let restored: AuthUser | null | undefined;
    session.restore().subscribe((value) => (restored = value));
    const pending = http.expectOne('/api/v1/auth/me');
    session.logout();
    pending.flush({ user });

    expect(session.token).toBeNull();
    expect(session.currentUser()).toBeNull();
    expect(restored).toBeNull();
    expect(session.authenticated()).toBe(false);
    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
  });
});
