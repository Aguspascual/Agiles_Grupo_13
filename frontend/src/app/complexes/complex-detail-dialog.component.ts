import { Component, ElementRef, EventEmitter, HostListener, Input, Output, AfterViewInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComplexRecord, ManagerOption } from './complex.model';

@Component({
  selector: 'app-complex-detail-dialog',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './complex-detail-dialog.component.html',
  styleUrl: './complex-detail-dialog.component.scss',
})
export class ComplexDetailDialogComponent implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true }) complex!: ComplexRecord;
  @Input() managers: ManagerOption[] = [];
  @Input() canDelete = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<ComplexRecord>();
  @Output() remove = new EventEmitter<ComplexRecord>();

  ngAfterViewInit(): void {
    this.host.nativeElement.querySelector<HTMLElement>('.close-button')?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }

  managerName(id: string): string {
    return this.managers.find(manager => manager.id === id)?.name
      ?? this.complex.managers?.find(manager => manager.id === id)?.name
      ?? 'Encargado';
  }
}