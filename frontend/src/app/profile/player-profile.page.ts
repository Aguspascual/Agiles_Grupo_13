import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LandingFooterComponent } from '../landing/landing-footer.component';
import { LandingHeaderComponent } from '../landing/landing-header.component';
import { StyledSelectComponent } from '../shared/styled-select.component';
import { AuthSessionService } from '../auth/auth-session.service';
import { UpdateProfileRequest } from '../auth/auth.model';
import { ProfileFeedbackStore } from './profile-feedback.store';

@Component({
  selector: 'app-player-profile-page',
  imports: [FormsModule, LandingHeaderComponent, LandingFooterComponent, StyledSelectComponent],
  templateUrl: './player-profile.page.html',
})
export class PlayerProfilePage {
  private readonly session = inject(AuthSessionService);
  private readonly feedback = inject(ProfileFeedbackStore);
  private readonly router = inject(Router);
  readonly email = this.session.currentUser()?.email ?? '';
  readonly profile: UpdateProfileRequest = this.createDraft();
  readonly zones = ['Casco Urbano', 'Gonnet', 'City Bell', 'San Carlos', 'Tolosa', 'Villa Elisa', 'Berisso / Ensenada'];
  readonly levels = ['Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'];
  readonly positions = [
    { value: '', label: 'Sin especificar', detail: 'Elegí un lado' },
    { value: 'Drive', label: 'Drive', detail: 'Lado derecho' },
    { value: 'Revés', label: 'Revés', detail: 'Lado izquierdo' },
    { value: 'Indistinto', label: 'Indistinto', detail: 'Ambos lados' },
  ];
  readonly hands = [{ value: '', label: 'Sin especificar' }, { value: 'Diestro', label: 'Diestro' }, { value: 'Zurdo', label: 'Zurdo' }];
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');

  constructor() {
    if (!this.session.currentUser()) void this.router.navigateByUrl('/ingresar');
  }

  save(): void {
    if (!this.isValid() || this.isSaving()) return;
    this.errorMessage.set('');
    this.isSaving.set(true);
    this.session.updateProfile({ ...this.profile, name: this.profile.name.trim() }).pipe(
      finalize(() => this.isSaving.set(false)),
    ).subscribe({
      next: () => {
        this.feedback.notifySaved();
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => this.errorMessage.set(this.errorText(error)),
    });
  }

  isValid(): boolean {
    return Boolean(this.profile.name.trim() && this.zones.includes(this.profile.zone) && this.levels.includes(this.profile.level));
  }

  private createDraft(): UpdateProfileRequest {
    const user = this.session.currentUser();
    return {
      name: user?.name ?? '', zone: user?.zone ?? '', level: user?.level ?? 'Principiante',
      position: user?.position ?? '', hand: user?.hand ?? '',
    };
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') return error.error.error;
    return 'No se pudo guardar el perfil. Revisá tu conexión e intentá de nuevo.';
  }
}
