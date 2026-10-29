import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthUser, LoginRequest, RegisterRequest } from './auth.model';
import { AuthTokenStore } from './auth-token.store';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly api = inject(AuthApiService);
  private readonly tokens = inject(AuthTokenStore);
  private restoreRequest: Observable<AuthUser | null> | null = null;

  readonly currentUser = signal<AuthUser | null>(null);
  readonly authenticated = computed(() => this.currentUser() !== null && this.tokens.current() !== null);

  get token(): string | null {
    return this.tokens.token();
  }

  register(request: RegisterRequest, remember: boolean): Observable<AuthUser> {
    return this.api.register(request).pipe(
      tap((response) => this.accept(response, remember)),
      map((response) => response.user),
    );
  }

  login(request: LoginRequest, remember: boolean): Observable<AuthUser> {
    return this.api.login(request).pipe(
      tap((response) => this.accept(response, remember)),
      map((response) => response.user),
    );
  }

  restore(): Observable<AuthUser | null> {
    if (!this.tokens.token()) {
      this.currentUser.set(null);
      return of(null);
    }
    if (this.currentUser()) return of(this.currentUser());
    if (this.restoreRequest) return this.restoreRequest;

    const request = this.api.me().pipe(
      tap((user) => {
        this.currentUser.set(user);
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.logout();
          return of(null);
        }
        return throwError(() => error);
      }),
      finalize(() => (this.restoreRequest = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.restoreRequest = request;
    return request;
  }

  accept(response: { user: AuthUser; token: string }, remember: boolean): void {
    this.tokens.save(response.token, remember);
    this.currentUser.set(response.user);
  }

  logout(): void {
    this.tokens.clear();
    this.currentUser.set(null);
  }
}
