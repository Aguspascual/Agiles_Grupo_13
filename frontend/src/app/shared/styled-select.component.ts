import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-styled-select',
  standalone: true,
  template: `
    <details #menu class="styled-select">
      <summary [attr.aria-label]="label + ': ' + value" aria-haspopup="menu">
        <span>{{ value }}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" /></svg>
      </summary>
      <div class="styled-select__options" role="menu" [attr.aria-label]="label">
        @for (option of options; track option) {
          <button type="button" role="menuitemradio" [attr.aria-checked]="option === value" [class.selected]="option === value" (click)="select(option)">
            <span>{{ option }}</span>
            @if (option === value) { <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 10 4 4 8-8" /></svg> }
          </button>
        }
      </div>
    </details>
  `,
  styleUrl: './styled-select.component.scss',
})
export class StyledSelectComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) options: string[] = [];
  @Input({ required: true }) value = '';
  @Output() valueChange = new EventEmitter<string>();
  @ViewChild('menu') private menu?: ElementRef<HTMLDetailsElement>;

  select(option: string): void {
    this.valueChange.emit(option);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  closeWhenClickingOutside(event: MouseEvent): void {
    if (!this.menu?.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void { this.close(); }

  private close(): void {
    if (this.menu) this.menu.nativeElement.open = false;
  }
}
