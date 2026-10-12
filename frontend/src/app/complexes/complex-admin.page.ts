import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ComplexCardComponent } from './complex-card.component';
import { ComplexAdminSidebarComponent } from './complex-admin-sidebar.component';
import { ComplexFormDialogComponent } from './complex-form-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ComplexDraft, ComplexRecord, DemoRole } from './complex.model';
import { ComplexPreviewStore } from './complex-preview.store';
import { ToastComponent } from '../shared/toast.component';

@Component({
  selector: 'app-complex-admin-page',
  standalone: true,
  imports: [ComplexAdminSidebarComponent, ComplexCardComponent, ComplexFormDialogComponent, ConfirmDialogComponent, ToastComponent],
  templateUrl: './complex-admin.page.html',
  styleUrl: './complex-admin.page.scss',
})
export class ComplexAdminPage implements OnDestroy {
  private readonly store = inject(ComplexPreviewStore);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingToast = '';

  readonly managers = this.store.managers;
  readonly role = signal<DemoRole>('admin');
  readonly managerId = signal(this.managers[0].id);
  readonly complexes = computed(() => this.store.forActor(this.role(), this.managerId()));
  readonly formOpen = signal(false);
  readonly formClosing = signal(false);
  readonly editing = signal<ComplexRecord | null>(null);
  readonly deleteTarget = signal<ComplexRecord | null>(null);
  readonly toastMessage = signal('');

  openCreate(): void {
    this.editing.set(null);
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  openEdit(complex: ComplexRecord): void {
    this.editing.set(complex);
    this.formClosing.set(false);
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.formClosing()) return;
    this.formClosing.set(true);
  }

  finishFormClose(): void {
    this.formOpen.set(false);
    this.formClosing.set(false);
    this.editing.set(null);
    if (this.pendingToast) {
      this.showToast(this.pendingToast);
      this.pendingToast = '';
    }
  }

  save(draft: ComplexDraft): void {
    const current = this.editing();
    if (current) {
      this.store.update(current.id, draft);
      this.pendingToast = 'Cambios guardados en esta vista.';
    } else {
      this.store.create(draft);
      this.pendingToast = 'Complejo creado en esta vista.';
    }
    this.closeForm();
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.store.remove(target.id);
    this.showToast(`${target.name} se quitó de esta vista.`);
    this.deleteTarget.set(null);
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
  }
}
