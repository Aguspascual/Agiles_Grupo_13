import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  return control.get('password')?.value === control.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
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
      name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)] }),
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
  requestInProgress = false;
  errorMessage = '';

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly session: AuthSessionService,
  ) {}

  onSubmit(): void {
    if (this.requestInProgress) return;
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.errorMessage = '';
    this.requestInProgress = true;
    const { name, email, password, zone, level, position, hand, fairPlay } = this.form.getRawValue();
    this.session.register({ name, email, password, zone, level, position, hand, fairPlay }, false).subscribe({
      next: () => {
        this.requestInProgress = false;
        void this.router.navigateByUrl(this.returnUrl() ?? '/');
      },
      error: (error: unknown) => {
        this.requestInProgress = false;
        this.errorMessage = this.registrationError(error);
      },
    });
  }

  private returnUrl(): string | null {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/') && !value.startsWith('//') ? value : null;
  }

  private registrationError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No pudimos crear tu cuenta. Intentá nuevamente.';
    if (error.status === 400) return 'Revisá los datos del formulario e intentá nuevamente.';
    if (error.status === 409) return 'Ya existe una cuenta con ese correo electrónico.';
    if (error.status === 0) return 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
    return 'No pudimos crear tu cuenta. Intentá nuevamente.';
  }
}
