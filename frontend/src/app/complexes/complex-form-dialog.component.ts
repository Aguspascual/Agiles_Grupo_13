import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComplexFormComponent } from './complex-form.component';
import { ComplexDraft, ComplexRecord, ManagerOption } from './complex.model';

@Component({
  selector: 'app-complex-form-dialog',
  standalone: true,
  imports: [ComplexFormComponent],
  templateUrl: './complex-form-dialog.component.html',
  styleUrl: './complex-form-dialog.component.scss',
})
export class ComplexFormDialogComponent {
  @Input() complex: ComplexRecord | null = null;
  @Input() managers: ManagerOption[] = [];
  @Input() closing = false;
  @Output() save = new EventEmitter<ComplexDraft>();
  @Output() close = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  finishClose(event: AnimationEvent): void {
    if (event.target === event.currentTarget && event.animationName.endsWith('dialog-exit')) this.closed.emit();
  }
}
