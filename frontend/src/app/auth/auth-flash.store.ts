import { Injectable, signal } from '@angular/core';

/** Aviso de una sola lectura para mostrar en la página siguiente (por ejemplo, tras registrarse). */
@Injectable({ providedIn: 'root' })
export class AuthFlashStore {
  private readonly pending = signal('');

  set(message: string): void {
    this.pending.set(message);
  }

  take(): string {
    const message = this.pending();
    this.pending.set('');
    return message;
  }
}