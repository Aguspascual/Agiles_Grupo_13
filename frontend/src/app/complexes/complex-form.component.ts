import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ComplexDraft, ComplexRecord, ManagerOption } from './complex.model';

@Component({
  selector: 'app-complex-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './complex-form.component.html',
  styleUrl: './complex-form.component.scss',
})
export class ComplexFormComponent implements OnChanges {
  @Input() complex: ComplexRecord | null = null;
  @Input() managers: ManagerOption[] = [];
  @Input() managersReadOnly = false;
  @Input() errorMessage = '';
  @Output() save = new EventEmitter<ComplexDraft>();
  @Output() cancel = new EventEmitter<void>();

  readonly zones = ['Casco Urbano', 'Gonnet', 'City Bell', 'San Carlos', 'Tolosa', 'Villa Elisa', 'Berisso / Ensenada'];
  zoneOpen = false;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    address: new FormControl('', { nonNullable: true, validators: Validators.required }),
    zone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    phone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    managerIds: new FormControl<string[]>([], { nonNullable: true, validators: Validators.minLength(1) }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['complex']) {
      this.form.reset(this.complex ? {
        name: this.complex.name,
        address: this.complex.address,
        zone: this.complex.zone,
        phone: this.complex.phone,
        managerIds: [...this.complex.managerIds],
      } : { name: '', address: '', zone: '', phone: '', managerIds: [] });
    }
  }

  toggleManager(id: string, checked: boolean): void {
    const selected = this.form.controls.managerIds.value.filter(managerId => managerId !== id);
    this.form.controls.managerIds.setValue(checked ? [...selected, id] : selected);
    this.form.controls.managerIds.markAsTouched();
  }

  isSelected(id: string): boolean {
    return this.form.controls.managerIds.value.includes(id);
  }

  selectZone(zone: string): void {
    this.form.controls.zone.setValue(zone);
    this.form.controls.zone.markAsTouched();
    this.zoneOpen = false;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) this.save.emit(this.form.getRawValue());
  }
}
