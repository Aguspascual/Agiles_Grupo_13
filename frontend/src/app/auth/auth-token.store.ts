import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthTokenStore {
  static readonly storageKey = 'padelmatch.auth.token';
  readonly current = signal(this.readStoredToken());

  token(): string | null {
    return this.current();
  }

  save(token: string, remember: boolean): void {
    this.clear();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(AuthTokenStore.storageKey, token);
    this.current.set(token);
  }

  clear(): void {
    localStorage.removeItem(AuthTokenStore.storageKey);
    sessionStorage.removeItem(AuthTokenStore.storageKey);
    this.current.set(null);
  }

  private readStoredToken(): string | null {
    return localStorage.getItem(AuthTokenStore.storageKey) ??
      sessionStorage.getItem(AuthTokenStore.storageKey);
  }
}
