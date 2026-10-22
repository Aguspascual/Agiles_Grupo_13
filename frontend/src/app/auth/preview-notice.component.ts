import { Component, input } from '@angular/core';

@Component({
  selector: 'app-preview-notice',
  standalone: true,
  template: `
    <p class="form-notice" role="status">
      <strong>Formulario listo para conectar.</strong> {{ message() }}
    </p>
  `,
})
export class PreviewNoticeComponent {
  readonly message = input.required<string>();
}
