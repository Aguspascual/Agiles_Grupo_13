import { Component, ElementRef, HostListener } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthApiService } from './auth-api.service';
import { AuthFlashStore } from './auth-flash.store';

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
      zones: new FormControl<string[]>([], { nonNullable: true, validators: Validators.required }),
      level: new FormControl('', { nonNullable: true, validators: Validators.required }),
      position: new FormControl('', { nonNullable: true, validators: Validators.required }),
      hand: new FormControl('', { nonNullable: true, validators: Validators.required }),
      fairPlay: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
    },
    { validators: passwordsMatch },
  );

  submitted = false;
  levelOpen = false;
  requestInProgress = false;
  errorMessage = '';

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly api: AuthApiService,
    private readonly flash: AuthFlashStore,
    private readonly host: ElementRef<HTMLElement>,
  ) {}

  isZoneSelected(zone: string): boolean {
    return this.form.controls.zones.value.includes(zone);
  }

  toggleZone(zone: string): void {
    const control = this.form.controls.zones;
    const current = control.value;
    control.setValue(current.includes(zone) ? current.filter((item) => item !== zone) : [...current, zone]);
    control.markAsTouched();
  }

  selectedLevelLabel(): string {
    const level = this.levels.find((item) => item.value === this.form.controls.level.value);
    return level ? `${level.value} · ${level.detail}` : 'Elegí tu nivel de pádel';
  }

  toggleLevel(): void {
    this.levelOpen = !this.levelOpen;
    if (this.levelOpen) setTimeout(() => this.focusOption(this.selectedIndex()));
  }

  selectLevel(value: string): void {
    this.form.controls.level.setValue(value);
    this.form.controls.level.markAsTouched();
    this.levelOpen = false;
    this.host.nativeElement.querySelector<HTMLElement>('#register-level')?.focus();
  }

  onLevelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.levelOpen) {
      this.levelOpen = false;
      this.host.nativeElement.querySelector<HTMLElement>('#register-level')?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!this.levelOpen) {
      this.toggleLevel();
      return;
    }
    const options = this.options();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1) : Math.max(current - 1, 0);
    options[next]?.focus();
  }

  @HostListener('document:click', ['$event'])
  closeLevelOnOutsideClick(event: Event): void {
    if (this.levelOpen && !(event.target as Element).closest('.level-select-control')) this.levelOpen = false;
  }

  private options(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.level-menu [role=option]'));
  }

  private selectedIndex(): number {
    return Math.max(this.levels.findIndex((item) => item.value === this.form.controls.level.value), 0);
  }

  private focusOption(index: number): void {
    this.options()[index]?.focus();
  }

  onSubmit(): void {
    if (this.requestInProgress) return;
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.revealFirstError();
      return;
    }

    this.errorMessage = '';
    this.requestInProgress = true;
    const { name, email, password, zones, level, position, hand, fairPlay } = this.form.getRawValue();
    // El contrato actual del servicio admite una sola zona: se envía la primera como zona principal.
    const zone = zones[0];
    this.api.register({ name, email, password, zone, level, position, hand, fairPlay }).subscribe({
      next: () => {
        this.requestInProgress = false;
        this.flash.set('¡Cuenta creada con éxito! Ya podés iniciar sesión.');
        const returnUrl = this.returnUrl();
        void this.router.navigate(['/ingresar'], returnUrl ? { queryParams: { returnUrl } } : {});
      },
      error: (error: unknown) => {
        this.requestInProgress = false;
        this.errorMessage = this.registrationError(error);
        if (error instanceof HttpErrorResponse && error.status === 409) this.form.controls.email.setErrors({ emailTaken: true });
        this.revealFirstError();
      },
    });
  }

  private revealFirstError(): void {
    setTimeout(() => {
      const target = this.host.nativeElement.querySelector<HTMLElement>('.field-error, .form-error');
      target?.scrollIntoView?.({ block: 'center' });
      const field = target?.closest('.field')?.querySelector<HTMLElement>('input');
      field?.focus({ preventScroll: true });
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
