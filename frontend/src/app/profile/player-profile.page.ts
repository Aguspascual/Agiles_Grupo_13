import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LandingFooterComponent } from '../landing/landing-footer.component';
import { LandingHeaderComponent } from '../landing/landing-header.component';
import { ToastComponent } from '../shared/toast.component';
import { StyledSelectComponent } from '../shared/styled-select.component';
import { PlayerProfileStore } from './player-profile.store';

@Component({
  selector: 'app-player-profile-page',
  imports: [FormsModule, LandingHeaderComponent, LandingFooterComponent, ToastComponent, StyledSelectComponent],
  templateUrl: './player-profile.page.html',
})
export class PlayerProfilePage {
  readonly store = inject(PlayerProfileStore);
  private readonly router = inject(Router);
  readonly profile = this.store.profile();
  readonly zones = ['Casco Urbano', 'Gonnet', 'City Bell', 'San Carlos', 'Tolosa', 'Villa Elisa', 'Berisso / Ensenada', 'Los Hornos'];
  readonly levels = ['8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'];
  readonly styles = ['Control y salida de pared', 'Juego agresivo', 'Defensa y consistencia', 'Versátil'];
  readonly photoUrl = signal('');
  readonly toastMessage = signal('');

  toggleZone(zone: string): void {
    const selected = this.profile.zones.includes(zone);
    this.profile.zones = selected
      ? this.profile.zones.filter((item) => item !== zone)
      : [...this.profile.zones, zone];
  }

  save(): void {
    this.store.save(this.profile);
    void this.router.navigateByUrl('/');
  }

  selectPhoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.toastMessage.set('Elegí una imagen JPG o PNG de hasta 5 MB');
      return;
    }
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl());
    this.photoUrl.set(URL.createObjectURL(file));
  }

  get initials(): string {
    return this.profile.nickname.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
  }
}
