import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { ComplexApiService } from '../complexes/complex-api.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
})
export class LoginPage {
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
    remember: new FormControl(true, { nonNullable: true }),
  });

  submitted = false;
  requestInProgress = false;
  errorMessage = '';
  passwordVisible = false;
  recoveryVisible = false;

  constructor(
    private readonly router: Router,
    private readonly session: AuthSessionService,
    private readonly complexes: ComplexApiService,
  ) {}

  onSubmit(): void {
    if (this.requestInProgress) return;
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.errorMessage = '';
    this.requestInProgress = true;
    const { email, password, remember } = this.form.getRawValue();
    this.session.login({ email, password }, remember).subscribe({
      next: () => {
        this.complexes.availableManagers().subscribe({
          next: () => this.navigateAfterLogin('/admin/complejos'),
          error: () => this.navigateAfterLogin('/'),
        });
      },
      error: (error: unknown) => {
        this.requestInProgress = false;
        this.errorMessage = this.loginError(error);
      },
    });
  }

  private navigateAfterLogin(path: string): void {
    this.requestInProgress = false;
    void this.router.navigateByUrl(path);
  }

  private loginError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo iniciar sesión. Intentá nuevamente.';
    if (error.status === 401) return 'El correo o la contraseña no son correctos.';
    if (error.status === 0) return 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
    return 'No se pudo iniciar sesión. Intentá nuevamente.';
  }
}
