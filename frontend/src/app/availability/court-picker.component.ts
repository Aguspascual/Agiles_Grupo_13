import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourtRecord } from '../courts/court.model';

@Component({
  selector: 'app-court-picker',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './court-picker.component.html',
  styleUrl: './court-picker.component.scss',
})
export class CourtPickerComponent {
  @Input({ required: true }) complexId!: string;
  @Input({ required: true }) courts: CourtRecord[] = [];
  @Input({ required: true }) currentCourt!: CourtRecord;
}
