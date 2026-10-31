import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

/** Desplegable que permite marcar varias opciones (por ejemplo, los encargados de un complejo). */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
})
export class MultiSelectComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() options: MultiSelectOption[] = [];
  @Input() selected: string[] = [];
  @Input() label = '';
  @Input() placeholder = 'Elegí una o más opciones';
  @Input() emptyText = 'No hay opciones disponibles';
  @Input() disabled = false;
  @Output() selectedChange = new EventEmitter<string[]>();

  open = false;

  get chosen(): MultiSelectOption[] {
    return this.options.filter((option) => this.selected.includes(option.value));
  }

  isSelected(value: string): boolean {
    return this.selected.includes(value);
  }

  toggleMenu(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) setTimeout(() => this.items()[0]?.focus());
  }

  toggle(option: MultiSelectOption): void {
    this.selectedChange.emit(
      this.isSelected(option.value) ? this.selected.filter((value) => value !== option.value) : [...this.selected, option.value],
    );
  }

  remove(option: MultiSelectOption, event: Event): void {
    event.stopPropagation();
    if (!this.disabled) this.selectedChange.emit(this.selected.filter((value) => value !== option.value));
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open) {
      event.preventDefault();
      event.stopPropagation();
      this.open = false;
      this.host.nativeElement.querySelector<HTMLElement>('.multi-trigger')?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!this.open) {
      this.toggleMenu();
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

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.multi-menu [role=option]'));
  }
}