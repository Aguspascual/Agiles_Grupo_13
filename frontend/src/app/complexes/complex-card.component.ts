import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComplexRecord, ManagerOption } from './complex.model';

@Component({
  selector: 'app-complex-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './complex-card.component.html',
  styleUrl: './complex-card.component.scss',
})
export class ComplexCardComponent {
  @Input({ required: true }) complex!: ComplexRecord;
  @Input() managers: ManagerOption[] = [];
  @Input() canManage = false;
  @Input() canDelete = false;
  @Output() edit = new EventEmitter<ComplexRecord>();
  @Output() remove = new EventEmitter<ComplexRecord>();

  managerName(id: string): string {
    return this.managers.find(manager => manager.id === id)?.name ?? this.complex.managers?.find(manager => manager.id === id)?.name ?? 'Encargado';
  }
}
