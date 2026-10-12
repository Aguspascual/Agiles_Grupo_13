import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PreviewNoticeComponent } from './preview-notice.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, PreviewNoticeComponent],
  templateUrl: './login.page.html',
})
export class LoginPage {
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
    remember: new FormControl(true, { nonNullable: true }),
  });

  submitted = false;
  ready = false;
  transitioning = false;
  passwordVisible = false;
  recoveryVisible = false;

  constructor(private readonly router: Router) {
    this.form.valueChanges.subscribe(() => (this.ready = false));
  }

  onSubmit(): void {
    if (this.transitioning) return;
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.valid) {
      const reducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        void this.router.navigateByUrl('/admin/complejos');
        return;
      }
      this.transitioning = true;
    }
  }

  finishTransition(event: AnimationEvent): void {
    if (this.transitioning && event.animationName === 'login-exit') {
      void this.router.navigateByUrl('/admin/complejos');
    }
  }
}
