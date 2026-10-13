import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COURT_FEATURES, CourtRecord } from './court.model';

@Component({
  selector: 'app-court-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './court-card.component.html',
  styleUrl: './court-card.component.scss',
})
export class CourtCardComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly features = COURT_FEATURES;
  @ViewChild('actionsTrigger') private actionsTrigger?: ElementRef<HTMLButtonElement>;
  @Input({ required: true }) court!: CourtRecord;
  @Output() edit = new EventEmitter<CourtRecord>();
  @Output() remove = new EventEmitter<CourtRecord>();
  actionsOpen = false;

  toggleActions(): void {
    this.actionsOpen = !this.actionsOpen;
  }

  closeActions(restoreFocus = false): void {
    this.actionsOpen = false;
    if (restoreFocus) this.actionsTrigger?.nativeElement.focus();
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.closeActions();
  }

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent): void {
    this.onDocumentClick(event);
  }
}
