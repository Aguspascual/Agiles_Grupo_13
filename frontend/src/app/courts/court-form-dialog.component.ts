import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CourtDraft, CourtRecord } from './court.model';
import { CourtFormComponent } from './court-form.component';

@Component({
  selector: 'app-court-form-dialog',
  standalone: true,
  imports: [CourtFormComponent],
  templateUrl: './court-form-dialog.component.html',
  styleUrl: './court-form-dialog.component.scss',
})
export class CourtFormDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('panel', { static: true }) private panel!: ElementRef<HTMLElement>;
  @Input() court: CourtRecord | null = null;
  @Input() closing = false;
  @Input() saving = false;
  @Output() save = new EventEmitter<CourtDraft>();
  @Output() close = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private returnFocus: HTMLElement | null = null;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngAfterViewInit(): void {
    const active = this.document.activeElement;
    this.returnFocus = active instanceof HTMLElement ? active : null;
    queueMicrotask(() =>
      this.panel.nativeElement.querySelector<HTMLElement>('#court-name')?.focus(),
    );
  }

  ngOnDestroy(): void {
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.closing) this.close.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusIsInside = this.panel.nativeElement.contains(this.document.activeElement);
    const focusable = this.panel.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) {
      event.preventDefault();
      this.panel.nativeElement.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (this.document.activeElement === first || !focusIsInside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (this.document.activeElement === last || !focusIsInside)) {
      event.preventDefault();
      first.focus();
    }
  }

  finishClose(event: AnimationEvent): void {
    if (event.target === event.currentTarget && event.animationName === 'court-dialog-exit')
      this.closed.emit();
  }
}
