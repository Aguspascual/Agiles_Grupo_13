import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { AuthTokenStore } from './auth-token.store';

const PUBLIC_AUTH_ENDPOINTS = new Set(['/api/v1/auth/register', '/api/v1/auth/login']);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokenStore = inject(AuthTokenStore);
  const session = inject(AuthSessionService);
  const token = tokenStore.token();
  const isApiRequest = request.url.startsWith('/api/');
  if (!token || !isApiRequest || PUBLIC_AUTH_ENDPOINTS.has(request.url.split('?')[0])) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        tokenStore.token() === token &&
        isApiRequest &&
        !PUBLIC_AUTH_ENDPOINTS.has(request.url.split('?')[0])
      ) {
        session.logout();
      }
      return throwError(() => error);
    }),
  );
};
