import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { COURT_FEATURES, CourtDraft, CourtFeatureId, CourtRecord } from './court.model';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Component({
  selector: 'app-court-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './court-form.component.html',
  styleUrl: './court-form.component.scss',
})
export class CourtFormComponent implements OnChanges {
  @Input() court: CourtRecord | null = null;
  @Input() disabled = false;
  @Output() save = new EventEmitter<CourtDraft>();
  @Output() cancel = new EventEmitter<void>();

  readonly features = COURT_FEATURES;
  imageError = '';

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(40)],
    }),
    covered: new FormControl(false, { nonNullable: true }),
    imageDataUrl: new FormControl<string | null>(null),
    features: new FormControl<CourtFeatureId[]>([], { nonNullable: true }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['court']) {
      this.imageError = '';
      this.form.reset({
        name: this.court?.name ?? '',
        covered: this.court?.covered ?? false,
        imageDataUrl: this.court?.imageDataUrl ?? null,
        features: [...(this.court?.features ?? [])],
      });
    }
  }

  hasFeature(featureId: CourtFeatureId): boolean {
    return this.form.controls.features.value.includes(featureId);
  }

  setFeature(featureId: CourtFeatureId, enabled: boolean): void {
    const selected = new Set(this.form.controls.features.value);
    if (enabled) selected.add(featureId);
    else selected.delete(featureId);
    this.form.controls.features.setValue(
      this.features.map((feature) => feature.id).filter((id) => selected.has(id)),
    );
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

  submit(): void {
    if (this.disabled) return;
    this.form.controls.name.setValue(this.form.controls.name.value.trim());
    this.form.markAllAsTouched();
    if (!this.form.valid) return;
    this.save.emit(this.form.getRawValue());
  }

  private readAsDataUrl(image: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Lectura inválida'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(image);
    });
  }
}
