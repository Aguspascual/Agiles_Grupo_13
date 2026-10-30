import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { FullMatch, FullMatchApiService } from './full-match-api.service';

@Component({
  selector: 'app-full-match-invitation-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './full-match-invitation.page.html',
  styleUrl: './full-match-invitation.page.scss',
})
export class FullMatchInvitationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FullMatchApiService);
  readonly session = inject(AuthSessionService);
  match: FullMatch | null = null;
  loading = true;
  accepting = false;
  message = '';
  token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.session.restore().pipe(
      catchError(() => of(null)),
      switchMap(() => this.api.invitation(this.token)),
    ).subscribe({
      next: (match) => { this.match = match; this.loading = false; },
      error: (error: unknown) => { this.message = this.loadError(error); this.loading = false; },
    });
  }

  accept(): void {
    if (this.accepting || !this.match) return;
    if (!this.session.currentUser()) {
      void this.router.navigate(['/ingresar'], { queryParams: { returnUrl: this.returnUrl } });
      return;
    }
    this.accepting = true;
    this.message = '';
    this.api.accept(this.token).subscribe({
      next: (match) => { this.match = match; this.accepting = false; },
      error: (error: unknown) => { this.message = this.acceptError(error); this.accepting = false; },
    });
  }

  get invitationStatus(): string {
    return this.match?.invitations[0]?.status ?? '';
  }

  get returnUrl(): string {
    return `/partidos/invitacion/${encodeURIComponent(this.token)}`;
  }

  private loadError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) return 'Esta invitación no existe o ya no está disponible.';
    return 'No pudimos cargar la invitación. Revisá el enlace e intentá nuevamente.';
  }

  private acceptError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No pudimos confirmar tu lugar. Intentá nuevamente.';
    if (error.status === 401) return 'Iniciá sesión para aceptar esta invitación.';
    if (error.status === 403) return 'La invitación está dirigida a otro correo.';
    if (error.status === 404) return 'La invitación ya no está disponible.';
    if (error.status === 409) return 'La invitación venció o ya fue utilizada.';
    return 'No pudimos confirmar tu lugar. Intentá nuevamente.';
  }
}
