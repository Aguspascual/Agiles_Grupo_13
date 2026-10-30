import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComplexRecord } from './complex.model';

@Component({
  selector: 'app-complex-card',
  standalone: true,
  templateUrl: './complex-card.component.html',
  styleUrl: './complex-card.component.scss',
})
export class ComplexCardComponent {
  @Input({ required: true }) complex!: ComplexRecord;
  @Output() open = new EventEmitter<ComplexRecord>();
}