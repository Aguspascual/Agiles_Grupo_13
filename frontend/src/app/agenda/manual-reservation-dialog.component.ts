import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  input,
  output,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';

export interface ManualContact {
  name: string;
  phone: string;
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { blank: true };
}

/** HU-15: datos de contacto de una reserva manual. El teléfono se guarda tal cual se escribe. */
@Component({
  selector: 'app-manual-reservation-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './manual-reservation-dialog.component.html',
  styleUrl: './manual-reservation-dialog.component.scss',
})
export class ManualReservationDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('panel', { static: true }) private panel!: ElementRef<HTMLElement>;

  readonly courtName = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly startsAt = input.required<string>();
  readonly endsAt = input.required<string>();
  readonly saving = input(false);
  readonly closing = input(false);
  readonly save = output<ManualContact>();
  readonly close = output<void>();
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private returnFocus: HTMLElement | null = null;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    phone: new FormControl('', { nonNullable: true, validators: [notBlank] }),
  });

  ngAfterViewInit(): void {
    const active = this.document.activeElement;
    this.returnFocus = active instanceof HTMLElement ? active : null;
    queueMicrotask(() => this.panel.nativeElement.querySelector<HTMLElement>('#manual-name')?.focus());
  }

  ngOnDestroy(): void {
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.closing()) this.close.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = this.panel.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) {
      event.preventDefault();
      this.panel.nativeElement.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const inside = this.panel.nativeElement.contains(this.document.activeElement);
    if (event.shiftKey && (this.document.activeElement === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (this.document.activeElement === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  }

  submit(): void {
    if (this.saving() || this.closing()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, phone } = this.form.getRawValue();
    this.save.emit({ name: name.trim(), phone: phone.trim() });
  }

  showError(field: 'name' | 'phone'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  finishClose(event: AnimationEvent): void {
    if (event.target === event.currentTarget && event.animationName === 'manual-dialog-exit') this.closed.emit();
  }
}
