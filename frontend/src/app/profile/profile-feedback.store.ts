import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProfileFeedbackStore {
  readonly saveNotice = signal('');

  notifySaved(): void { this.saveNotice.set('Perfil actualizado correctamente'); }
  clear(): void { this.saveNotice.set(''); }
}
