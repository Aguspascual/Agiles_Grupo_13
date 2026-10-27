import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent implements OnChanges, OnDestroy {
  @Input() message = '';
  @Input() duration = 3500;
  @Output() dismiss = new EventEmitter<void>();
  private dismissTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    if (this.message) {
      this.dismissTimer = setTimeout(() => this.dismiss.emit(), this.duration);
    }
  }

  ngOnDestroy(): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
  }
}
