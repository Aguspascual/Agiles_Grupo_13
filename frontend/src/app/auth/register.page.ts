import { Component } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PreviewNoticeComponent } from './preview-notice.component';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  return control.get('password')?.value === control.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, PreviewNoticeComponent],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  readonly zones = ['Casco Urbano', 'Gonnet', 'City Bell', 'San Carlos', 'Tolosa', 'Villa Elisa', 'Berisso / Ensenada'];
  readonly levels = [
    { value: 'Principiante', detail: 'Primeros partidos y peloteos' },
    { value: '8va', detail: 'Empezando a competir' },
    { value: '7ma', detail: 'Conocés reglas y rebotes' },
    { value: '6ta', detail: 'Ritmo constante en fondo y red' },
    { value: '5ta', detail: 'Buen manejo táctico y volea' },
    { value: '4ta', detail: 'Juego avanzado' },
    { value: '3ra', detail: 'Nivel competitivo' },
    { value: '2da', detail: 'Nivel competitivo alto' },
    { value: '1ra', detail: 'Máxima categoría' },
  ];

  readonly form = new FormGroup(
    {
      name: new FormControl('', { nonNullable: true, validators: Validators.required }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      zone: new FormControl('', { nonNullable: true, validators: Validators.required }),
      level: new FormControl('', { nonNullable: true, validators: Validators.required }),
      position: new FormControl('', { nonNullable: true }),
      hand: new FormControl('', { nonNullable: true }),
      fairPlay: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
    },
    { validators: passwordsMatch },
  );

  submitted = false;
  ready = false;

  constructor() {
    this.form.valueChanges.subscribe(() => (this.ready = false));
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.ready = this.form.valid;
  }
}
