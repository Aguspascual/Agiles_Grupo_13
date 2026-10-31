import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { MatchPreview, PlayerPreview } from './landing.data';
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
  @Output() leave = new EventEmitter<MatchPreview>();
  @Input() leaving = false;
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('joinButton') private joinButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmJoinButton') private confirmJoinButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('leaveButton') private leaveButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmLeaveButton') private confirmLeaveButton?: ElementRef<HTMLButtonElement>;
  closing = false;
  confirmationOpen = false;
  leaveConfirmationOpen = false;
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
    if (this.leaveConfirmationOpen) {
      this.leaveConfirmationOpen = false;
      setTimeout(() => this.leaveButton?.nativeElement.focus());
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

  requestLeave(): void {
    this.leaveConfirmationOpen = true;
    setTimeout(() => this.confirmLeaveButton?.nativeElement.focus());
  }

  cancelLeave(): void {
    this.leaveConfirmationOpen = false;
    setTimeout(() => this.leaveButton?.nativeElement.focus());
  }

  confirmLeave(): void {
    this.leaveConfirmationOpen = false;
    this.leave.emit(this.match);
  }

  ngOnDestroy(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  get startTime(): string {
    return this.match.time.match(/\d{1,2}:\d{2}/)?.[0] ?? this.match.time;
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

  isCurrentPlayer(playerName: string): boolean {
    const accountName = this.session.currentUser()?.name;
    if (!accountName || !playerName) return false;
    const normalize = (name: string) => name.trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
    const account = normalize(accountName);
    const player = normalize(playerName);
    const [firstName, ...surnames] = account.split(' ');
    const shortName = surnames.length ? `${firstName} ${surnames[0][0]}.` : firstName;
    return player === account || player === normalize(shortName);
  }

  get alreadyJoined(): boolean {
    return this.match.players.some((player) => this.isCurrentPlayer(player.name));
  }

  get canLeave(): boolean {
    if (!this.match.date) return false;
    const time = this.match.time.match(/(\d{1,2}:\d{2})/u)?.[1];
    if (!time) return false;
    const startsAt = new Date(`${this.match.date}T${time}:00-03:00`).getTime();
    return Number.isFinite(startsAt) && startsAt - Date.now() >= 2 * 60 * 60 * 1000;
  }

  get levelWarning(): string {
    const currentLevel = this.session.currentUser()?.level;
    if (!currentLevel) return '';
    const order = ['Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'];
    const current = order.indexOf(currentLevel);
    const targets = (this.match.levels ?? [this.match.level]).map((level) => order.indexOf(level)).filter((index) => index >= 0);
    return current >= 0 && targets.length > 0 && targets.every((target) => Math.abs(current - target) > 1)
      ? `Tu nivel declarado es ${currentLevel} y el buscado es ${this.match.level}. Podés sumarte igual.`
      : '';
  }

  /** Cada jugador ocupa el lugar que eligió (1 a 4); quienes no lo informaron completan los libres. */
  get courtSlots() {
    const taken = new Map<number, PlayerPreview>();
    const unplaced: PlayerPreview[] = [];
    for (const player of this.match.players) {
      if (player.slot && player.slot >= 1 && player.slot <= 4 && !taken.has(player.slot)) taken.set(player.slot, player);
      else unplaced.push(player);
    }
    return Array.from({ length: 4 }, (_, index) => {
      const player = taken.get(index + 1) ?? (taken.has(index + 1) ? undefined : unplaced.shift());
      return {
        player,
        team: index < 2 ? 'Pareja A' : 'Pareja B',
        side: index % 2 === 0 ? 'Drive' : 'Revés',
        position: player?.position ?? 'Lugar disponible',
        isCurrentUser: player ? this.isCurrentPlayer(player.name) : false,
      };
    });
  }}
