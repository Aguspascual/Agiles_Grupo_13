import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FullMatch, FullMatchApiService, FullMatchInvitation } from './full-match-api.service';

@Component({
  selector: 'app-full-match-created',
  imports: [DatePipe],
  templateUrl: './full-match-created.component.html',
  styleUrl: './full-match-created.component.scss',
})
export class FullMatchCreatedComponent implements OnInit, OnDestroy {
  @Input({ required: true }) match!: FullMatch;
  @Output() close = new EventEmitter<void>();
  private readonly api = inject(FullMatchApiService);
  private statusTimer?: ReturnType<typeof setInterval>;
  view: FullMatch | null = null;
  copiedInviteId = '';
  failedInviteId = '';
  copyError = '';

  ngOnInit(): void {
    this.view = this.match;
    this.statusTimer = setInterval(() => {
      if (!this.view || this.view.status !== 'pending') return;
      this.api.get(this.view.id).subscribe({ next: (match) => this.view = match });
    }, 15_000);
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearInterval(this.statusTimer);
  }

  get acceptedInvitations(): number {
    return this.view?.invitations.filter((invite) => invite.status === 'accepted').length ?? 0;
  }

  statusLabel(status: FullMatchInvitation['status']): string {
    return status === 'accepted' ? 'Confirmado' : status === 'expired' ? 'Venció' : 'Pendiente';
  }

  invitationUrl(invitation: FullMatchInvitation): string {
    return invitation.token
      ? `${window.location.origin}/partidos/invitacion/${encodeURIComponent(invitation.token)}`
      : '';
  }

  emailUrl(invitation: FullMatchInvitation): string {
    if (!this.view || !invitation.email) return '';
    const subject = `Invitación a jugar en ${this.view.complex}`;
    const body = `Hola ${invitation.name}, te invito a jugar el ${this.view.date} de ${this.view.startsAt} a ${this.view.endsAt} en ${this.view.complex}. Confirmá tu lugar acá: ${this.invitationUrl(invitation)}`;
    return `mailto:${encodeURIComponent(invitation.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async copyInvitation(invitation: FullMatchInvitation): Promise<void> {
    this.copyError = '';
    try {
      await navigator.clipboard.writeText(this.invitationUrl(invitation));
      this.copiedInviteId = invitation.id;
      this.failedInviteId = '';
    } catch {
      this.failedInviteId = invitation.id;
      this.copyError = 'No se pudo copiar el enlace. Seleccionalo y copialo manualmente.';
    }
  }
}
