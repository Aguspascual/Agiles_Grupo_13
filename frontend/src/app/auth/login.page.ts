import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  passwordVisible = false;
  recoveryVisible = false;

  constructor() {
    this.form.valueChanges.subscribe(() => (this.ready = false));
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.ready = this.form.valid;
  }
}
