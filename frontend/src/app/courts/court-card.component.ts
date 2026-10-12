import { Component, EventEmitter, Input, Output } from '@angular/core';
import { COURT_FEATURES, CourtRecord } from './court.model';

@Component({
  selector: 'app-court-card',
  standalone: true,
  templateUrl: './court-card.component.html',
  styleUrl: './court-card.component.scss',
})
export class CourtCardComponent {
  readonly features = COURT_FEATURES;
  @Input({ required: true }) court!: CourtRecord;
  @Output() edit = new EventEmitter<CourtRecord>();
  @Output() remove = new EventEmitter<CourtRecord>();
}
