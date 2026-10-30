import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from './auth.model';

const AUTH_API = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<unknown>(`${AUTH_API}/register`, request)
      .pipe(map((response) => parseAuthResponse(response)));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<unknown>(`${AUTH_API}/login`, request)
      .pipe(map((response) => parseAuthResponse(response)));
  }

  me(): Observable<AuthUser> {
    return this.http
      .get<unknown>(`${AUTH_API}/me`)
      .pipe(map((response) => parseUserEnvelope(response)));
  }
}

function parseAuthResponse(value: unknown): AuthResponse {
  if (!isRecord(value) || typeof value['token'] !== 'string' || !value['token']) {
    throw new Error('Respuesta de autenticación inválida');
  }
  return { user: parseAuthUser(value['user']), token: value['token'] };
}

function parseUserEnvelope(value: unknown): AuthUser {
  if (!isRecord(value)) throw new Error('Respuesta de sesión inválida');
  return parseAuthUser(value['user']);
}

function parseAuthUser(value: unknown): AuthUser {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['name'] !== 'string' ||
    typeof value['email'] !== 'string' ||
    typeof value['zone'] !== 'string' ||
    typeof value['level'] !== 'string' ||
    (value['position'] !== undefined && typeof value['position'] !== 'string') ||
    (value['hand'] !== undefined && typeof value['hand'] !== 'string')
  ) {
    throw new Error('Respuesta de usuario inválida');
  }
  return {
    id: value['id'],
    name: value['name'],
    email: value['email'],
    zone: value['zone'],
    level: value['level'],
    ...(value['position'] === undefined ? {} : { position: value['position'] }),
    ...(value['hand'] === undefined ? {} : { hand: value['hand'] }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
