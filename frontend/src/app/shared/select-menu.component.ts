import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
  /** Opción de acción (por ejemplo "Crear cancha"): se muestra separada y destacada. */
  action?: boolean;
}

/** Selector desplegable con el estilo de la aplicación (lista accesible por teclado). */
@Component({
  selector: 'app-select-menu',
  standalone: true,
  templateUrl: './select-menu.component.html',
  styleUrl: './select-menu.component.scss',
})
export class SelectMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() options: SelectOption[] = [];
  @Input() value = '';
  @Input() label = '';
  @Input() placeholder = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  open = false;

  get selectedLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? '';
  }

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) setTimeout(() => this.items()[Math.max(this.options.findIndex((o) => o.value === this.value), 0)]?.focus());
  }

  choose(option: SelectOption): void {
    this.open = false;
    this.trigger()?.focus();
    this.valueChange.emit(option.value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open) {
      event.preventDefault();
      this.open = false;
      this.trigger()?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!this.open) {
      this.toggle();
      return;
    }
    const items = this.items();
    const current = items.indexOf(document.activeElement as HTMLElement);
    items[event.key === 'ArrowDown' ? Math.min(current + 1, items.length - 1) : Math.max(current - 1, 0)]?.focus();
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: Event): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) this.open = false;
  }

  private trigger(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.select-trigger');
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.select-menu [role=option]'));
  }
}