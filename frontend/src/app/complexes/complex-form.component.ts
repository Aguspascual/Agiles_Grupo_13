import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { ComplexDraft, ComplexPricing, ComplexRecord, ManagerOption } from './complex.model';

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
    pricing: new FormGroup({
      turnPrice: new FormControl('', { nonNullable: true }),
      depositEnabled: new FormControl(false, { nonNullable: true }),
      depositType: new FormControl<'fixed' | 'percentage'>('fixed', { nonNullable: true }),
      depositValue: new FormControl('', { nonNullable: true }),
    }, { validators: control => pricingValidator(control, this.isLegacyUnpricedComplex()) }),
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
        pricing: this.complex.pricing ?? emptyPricing(),
      } : { name: '', address: '', zone: '', phone: '', imageDataUrl: null, managerIds: [], pricing: emptyPricing() });
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

  get pricingErrorMessage(): string {
    const errors = this.form.controls.pricing.errors;
    if (errors?.['turnPriceInvalid']) return 'IngresÃ¡ un precio de turno positivo en ARS, con hasta dos decimales.';
    if (errors?.['depositValueRequired']) return 'IngresÃ¡ el valor de la seÃ±a.';
    if (errors?.['fixedDepositInvalid']) return 'La seÃ±a fija debe ser positiva y no superar el precio del turno.';
    if (errors?.['percentageInvalid']) return 'El porcentaje debe estar entre 1% y 100%.';
    return 'RevisÃ¡ los valores de precio y seÃ±a.';
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
    if (!this.form.valid) return;
    const draft = this.form.getRawValue();
    const pricing = draft.pricing;
    if (this.isLegacyUnpricedComplex() && !pricing.depositEnabled && parseMinorUnits(pricing.turnPrice) === 0 &&
      (pricing.depositValue.trim() === '' || parseMinorUnits(pricing.depositValue) === 0)) {
      const legacyDraft = { ...draft } as ComplexDraft;
      delete legacyDraft.pricing;
      this.save.emit(legacyDraft);
      return;
    }
    this.save.emit(draft);
  }

  private isLegacyUnpricedComplex(): boolean {
    const pricing = this.complex?.pricing;
    return !!pricing && !pricing.depositEnabled && parseMinorUnits(pricing.turnPrice) === 0;
  }
}

function emptyPricing(): ComplexPricing {
  return { turnPrice: '', depositEnabled: false, depositType: 'fixed', depositValue: '' };
}

const pricingValidator = (control: AbstractControl, allowLegacyUnpriced: boolean): ValidationErrors | null => {
  const pricing = control.getRawValue() as ComplexPricing;
  const turnPrice = parseMinorUnits(pricing.turnPrice);
  if (allowLegacyUnpriced && !pricing.depositEnabled && turnPrice === 0 &&
    (pricing.depositValue.trim() === '' || parseMinorUnits(pricing.depositValue) === 0)) return null;
  if (turnPrice === null || turnPrice <= 0) return { turnPriceInvalid: true };
  const deposit = pricing.depositValue.trim() === '' ? 0 : parseMinorUnits(pricing.depositValue);
  if (deposit === null) return pricing.depositEnabled ? { depositValueRequired: true } : { fixedDepositInvalid: true };
  if (!pricing.depositEnabled && deposit === 0) return null;
  if (pricing.depositType === 'fixed') {
    if (deposit <= 0 || deposit > turnPrice) return pricing.depositEnabled || deposit > 0 ? { fixedDepositInvalid: true } : null;
  } else if (deposit < 100 || deposit > 10000) {
    return pricing.depositEnabled || deposit > 0 ? { percentageInvalid: true } : null;
  }
  return null;
};

function parseMinorUnits(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(units) ? units : null;
}
