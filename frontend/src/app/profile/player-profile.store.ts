import { Injectable, signal } from '@angular/core';

export interface PlayerProfile {
  fullName: string;
  nickname: string;
  email: string;
  phone: string;
  zones: string[];
  level: string;
  position: 'Drive' | 'Revés' | 'Indistinto';
  hand: 'Diestro' | 'Zurdo';
  style: string;
  publicProfile: boolean;
  directInvitations: boolean;
  shareWhatsapp: boolean;
}

const STORAGE_KEY = 'padelmatch.player-profile.v1';
const DEFAULT_PROFILE: PlayerProfile = {
  fullName: 'Lucas Marchetti',
  nickname: 'Lucas M.',
  email: 'lucas.marchetti@gmail.com',
  phone: '221 542-8819',
  zones: ['Casco Urbano', 'Gonnet', 'City Bell'],
  level: '5ta',
  position: 'Drive',
  hand: 'Diestro',
  style: 'Control y salida de pared',
  publicProfile: true,
  directInvitations: true,
  shareWhatsapp: true,
};

@Injectable({ providedIn: 'root' })
export class PlayerProfileStore {
  private readonly profileState = signal(this.readProfile());
  readonly profile = this.profileState.asReadonly();
  readonly saveNotice = signal('');

  save(profile: PlayerProfile): void {
    const next = { ...profile, zones: [...profile.zones] };
    this.profileState.set(next);
    this.saveNotice.set('Perfil actualizado correctamente');
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // La pantalla sigue siendo usable si el navegador bloquea el almacenamiento local.
    }
  }

  clearSaveNotice(): void { this.saveNotice.set(''); }

  private readProfile(): PlayerProfile {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_PROFILE, ...JSON.parse(stored) } as PlayerProfile;
    } catch {
      // Se usan los datos de demostración cuando el almacenamiento no está disponible.
    }
    return { ...DEFAULT_PROFILE, zones: [...DEFAULT_PROFILE.zones] };
  }
}
