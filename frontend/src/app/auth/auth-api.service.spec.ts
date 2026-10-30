import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';
import { AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest } from './auth.model';

describe('AuthApiService', () => {
  let api: AuthApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía únicamente el DTO de registro acordado', () => {
    const request: RegisterRequest = {
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'password-123',
      zone: 'Gonnet',
      level: '7ma',
      position: '',
      hand: '',
      fairPlay: true,
    };
    const response: AuthResponse = {
      user: { id: 'user-1', name: 'Ana Pérez', email: 'ana@example.com', zone: 'Gonnet', level: '7ma' },
      token: 'jwt-token',
    };
    let result: AuthResponse | undefined;

    api.register(request).subscribe((value) => (result = value));

    const req = http.expectOne('/api/v1/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(Object.keys(req.request.body).sort()).toEqual(
      ['email', 'fairPlay', 'hand', 'level', 'name', 'password', 'position', 'zone'].sort(),
    );
    req.flush(response, { status: 201, statusText: 'Created' });
    expect(result).toEqual(response);
  });

  it('envía únicamente email y password para iniciar sesión', () => {
    const request: LoginRequest = { email: 'ana@example.com', password: 'password-123' };
    const response: AuthResponse = {
      user: { id: 'user-1', name: 'Ana Pérez', email: 'ana@example.com', zone: 'Gonnet', level: '7ma' },
      token: 'jwt-token',
    };
    let result: AuthResponse | undefined;

    api.login(request).subscribe((value) => (result = value));

    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(Object.keys(req.request.body).sort()).toEqual(['email', 'password']);
    req.flush(response);
    expect(result).toEqual(response);
  });

  it('consulta la sesión en /me y devuelve el objeto user de la respuesta', () => {
    const user = { id: 'user-1', name: 'Ana Pérez', email: 'ana@example.com', zone: 'Gonnet', level: '7ma' };
    let result: unknown;

    api.me().subscribe((value) => (result = value));

    const req = http.expectOne('/api/v1/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush({ user });
    expect(result).toEqual(user);
  });

  it('actualiza el perfil propio enviando solo los cinco campos admitidos', () => {
    const request: UpdateProfileRequest = {
      name: 'Ana Pérez', zone: 'Gonnet', level: '6ta', position: 'Drive', hand: 'Diestro',
    };
    const user = { id: 'user-1', ...request, email: 'ana@example.com' };
    let result: unknown;

    api.updateProfile(request).subscribe((value) => (result = value));

    const req = http.expectOne('/api/v1/auth/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    expect(Object.keys(req.request.body).sort()).toEqual(['hand', 'level', 'name', 'position', 'zone']);
    req.flush({ user });
    expect(result).toEqual(user);
  });

  it('rechaza una respuesta de login sin token utilizable', () => {
    let error: unknown;
    api.login({ email: 'ana@example.com', password: 'password-123' }).subscribe({
      error: (value: unknown) => (error = value),
    });
    http.expectOne('/api/v1/auth/login').flush({ user: { id: 'u1' }, token: '' });
    expect(error).toBeInstanceOf(Error);
  });
});
