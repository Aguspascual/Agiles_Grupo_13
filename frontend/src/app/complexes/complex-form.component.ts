import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { ComplexDraft, ComplexRecord, ManagerOption } from './complex.model';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Component({
  selector: 'app-complex-form',
  standalone: true,
  imports: [ReactiveFormsModule, MultiSelectComponent],
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
  imageError = '';
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    address: new FormControl('', { nonNullable: true, validators: Validators.required }),
    zone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    phone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    imageDataUrl: new FormControl<string | null>(null),
    managerIds: new FormControl<string[]>([], { nonNullable: true, validators: Validators.required }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['complex']) {
      this.form.reset(this.complex ? {
        name: this.complex.name,
        address: this.complex.address,
        zone: this.complex.zone,
        phone: this.complex.phone,
        imageDataUrl: this.complex.imageDataUrl ?? null,
        managerIds: [...this.complex.managerIds],
      } : { name: '', address: '', zone: '', phone: '', imageDataUrl: null, managerIds: [] });
      this.imageError = '';
    }
    if ((changes['complex'] || changes['managers']) && !this.managersReadOnly && this.managers.length) {
      // Un encargado debe ser un usuario administrador: se descartan las asignaciones que ya no lo cumplen.
      const allowed = new Set(this.managers.map((manager) => manager.id));
      const control = this.form.controls.managerIds;
      const valid = control.value.filter((id) => allowed.has(id));
      if (valid.length !== control.value.length) control.setValue(valid);
    }
  }

  get managerOptions(): MultiSelectOption[] {
    return this.managers.map((manager) => ({ value: manager.id, label: manager.name, hint: manager.email }));
  }

  setManagers(ids: string[]): void {
    this.form.controls.managerIds.setValue(ids);
    this.form.controls.managerIds.markAsTouched();
  }

  selectZone(zone: string): void {
    this.form.controls.zone.setValue(zone);
    this.form.controls.zone.markAsTouched();
    this.zoneOpen = false;
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const image = input.files?.[0];
    if (!image) return;
    this.imageError = '';
    if (!SUPPORTED_IMAGE_TYPES.has(image.type)) {
      this.imageError = 'Elegí una imagen PNG, JPG o WebP.';
      input.value = '';
      return;
    }
    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      this.imageError = 'La imagen no puede superar 5 MB.';
      input.value = '';
      return;
    }
    try {
      this.form.controls.imageDataUrl.setValue(await this.readAsDataUrl(image));
    } catch {
      this.imageError = 'No pudimos leer la imagen. Probá con otro archivo.';
      input.value = '';
    }
  }

  clearImage(input?: HTMLInputElement): void {
    this.form.controls.imageDataUrl.setValue(null);
    this.imageError = '';
    if (input) input.value = '';
  }

  private readAsDataUrl(image: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Lectura inválida'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(image);
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) this.save.emit(this.form.getRawValue());
  }
}
