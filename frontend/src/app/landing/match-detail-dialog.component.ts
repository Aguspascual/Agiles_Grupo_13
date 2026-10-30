import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { MatchPreview } from './landing.data';
import { AuthSessionService } from '../auth/auth-session.service';

@Component({
  selector: 'app-match-detail-dialog',
  templateUrl: './match-detail-dialog.component.html',
})
export class MatchDetailDialogComponent implements AfterViewInit, OnDestroy {
  private readonly session = inject(AuthSessionService);
  @Input({ required: true }) match!: MatchPreview;
  @Output() close = new EventEmitter<void>();
  @Output() join = new EventEmitter<MatchPreview>();
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('joinButton') private joinButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmJoinButton') private confirmJoinButton?: ElementRef<HTMLButtonElement>;
  closing = false;
  confirmationOpen = false;
  private closeTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.closeButton?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.confirmationOpen) {
      this.confirmationOpen = false;
      setTimeout(() => this.joinButton?.nativeElement.focus());
      return;
    }
    this.requestClose();
  }

  requestClose(): void {
    if (this.closing) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.close.emit();
      return;
    }
    this.closing = true;
    this.closeTimer = setTimeout(() => this.close.emit(), 220);
  }

  requestJoin(): void {
    this.confirmationOpen = true;
    setTimeout(() => this.confirmJoinButton?.nativeElement.focus());
  }

  cancelJoin(): void {
    this.confirmationOpen = false;
    setTimeout(() => this.joinButton?.nativeElement.focus());
  }

  confirmJoin(): void {
    this.confirmationOpen = false;
    this.join.emit(this.match);
    this.requestClose();
  }

  ngOnDestroy(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  get endTime(): string {
    const start = this.match.time.match(/(\d{1,2}):(\d{2})/);
    const duration = Number(this.match.duration.match(/\d+/)?.[0] ?? 90);
    if (!start) return '';
    const end = (Number(start[1]) * 60 + Number(start[2]) + duration) % 1440;
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  }

  get freeSpots(): number {
    return Math.max(0, 4 - this.match.players.length);
  }

  get levelWarning(): string {
    const currentLevel = this.session.currentUser()?.level;
    if (!currentLevel) return '';
    const order = ['Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'];
    const current = order.indexOf(currentLevel);
    const target = order.indexOf(this.match.level);
    return current >= 0 && target >= 0 && Math.abs(current - target) > 1
      ? `Tu nivel declarado es ${currentLevel} y el buscado es ${this.match.level}. Podés sumarte igual.`
      : '';
  }

  get courtSlots() {
    return Array.from({ length: 4 }, (_, index) => ({
      player: this.match.players[index],
      team: index < 2 ? 'Pareja A' : 'Pareja B',
      position: this.match.players[index]?.position ?? 'Lugar disponible',
    }));
  }
}
