import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, inject, signal, AfterViewInit } from '@angular/core';
import { concatMap, finalize, from } from 'rxjs';
import { WeeklyScheduleRule } from './availability.model';
import { ScheduleApiService } from './schedule-api.service';
import { changedDays, loadMessage, saveMessage } from './schedule-utils';
import { WeeklyScheduleFormComponent } from './weekly-schedule-form.component';

/** Modal para cargar los horarios semanales de una cancha sin salir de la vista del complejo. */
@Component({
  selector: 'app-court-schedule-dialog',
  standalone: true,
  imports: [WeeklyScheduleFormComponent],
  templateUrl: './court-schedule-dialog.component.html',
  styleUrl: './court-schedule-dialog.component.scss',
})
export class CourtScheduleDialogComponent implements OnInit, AfterViewInit {
  private readonly schedules = inject(ScheduleApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private pendingRules: WeeklyScheduleRule[] | null = null;

  @Input({ required: true }) complexId = '';
  @Input({ required: true }) courtId = '';
  @Input() courtName = '';
  @Output() close = new EventEmitter<void>();

  readonly rules = signal<WeeklyScheduleRule[]>([]);
  readonly formRules = signal<WeeklyScheduleRule[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly feedback = signal('');

  ngOnInit(): void {
    this.fetch();
  }

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

  saveRules(incoming: WeeklyScheduleRule[]): void {
    if (this.saving()) {
      this.pendingRules = incoming;
      return;
    }
    const changed = changedDays(this.rules(), incoming);
    if (!changed.length) return;
    this.saving.set(true);
    this.feedback.set('');
    from(changed)
      .pipe(
        concatMap((rule) => this.schedules.saveDay(this.complexId, this.courtId, rule)),
        finalize(() => this.finishSave()),
      )
      .subscribe({
        next: (saved) => this.rules.update((rules) => rules.map((rule) => (rule.weekday === saved.weekday ? saved : rule))),
        complete: () => this.feedback.set('Horarios actualizados.'),
        error: (error: unknown) => {
          this.pendingRules = null;
          this.feedback.set(saveMessage(error));
          this.fetch();
        },
      });
  }

  private finishSave(): void {
    this.saving.set(false);
    const pending = this.pendingRules;
    this.pendingRules = null;
    if (pending) this.saveRules(pending);
  }

  private fetch(): void {
    this.schedules.load(this.complexId, this.courtId).subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.formRules.set(rules);
        this.loadError.set('');
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(loadMessage(error));
        this.loading.set(false);
      },
    });
  }
}