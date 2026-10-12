import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComplexRecord, ManagerOption } from './complex.model';

@Component({
  selector: 'app-complex-card',
  standalone: true,
  templateUrl: './complex-card.component.html',
  styleUrl: './complex-card.component.scss',
})
export class ComplexCardComponent {
  @Input({ required: true }) complex!: ComplexRecord;
  @Input() managers: ManagerOption[] = [];
  @Input() canManage = false;
  @Output() edit = new EventEmitter<ComplexRecord>();
  @Output() remove = new EventEmitter<ComplexRecord>();

  managerName(id: string): string {
    return this.managers.find(manager => manager.id === id)?.name ?? 'Encargado';
  }
}
