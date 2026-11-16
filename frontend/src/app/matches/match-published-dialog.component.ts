import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatchPreview } from '../landing/landing.data';
import { MatchShareService } from './match-share.service';

@Component({
  selector: 'app-match-published-dialog',
  templateUrl: './match-published-dialog.component.html',
  styleUrl: './match-published-dialog.component.scss',
})
export class MatchPublishedDialogComponent {
  @Input({ required: true }) match!: MatchPreview;
  @Output() close = new EventEmitter<void>();
  private readonly share = inject(MatchShareService);
  copied = false;
  copyError = '';

  get matchUrl(): string {
    return this.share.matchLink(this.match.id);
  }

  get whatsappUrl(): string {
    return this.share.whatsappLink(this.match);
  }

  async copyLink(): Promise<void> {
    this.copyError = '';
    try {
      await navigator.clipboard.writeText(this.matchUrl);
      this.copied = true;
    } catch {
      this.copyError = 'No se pudo copiar automáticamente. Seleccioná el enlace para copiarlo.';
    }
  }
}
