import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GridSlot, SLOT_STATE_LABELS, missingPlayersLabel } from './slot-grid.model';

/**
 * Resumen del turno elegido. Sin sesión, invita a ingresar: la reserva (HU-06) y la unión a un
 * partido abierto (HU-11) reemplazan este llamado cuando estén disponibles.
 */
@Component({
  selector: 'app-slot-summary',
  imports: [RouterLink],
  template: `
    <section
      class="slot-summary"
      aria-live="polite"
      [attr.aria-label]="'Turno elegido: ' + heading()"
    >
      <div class="slot-summary__info">
        <span [class]="'slot-badge is-' + slot().state">
          <i class="slot-icon" aria-hidden="true"></i>{{ stateLabel() }}
        </span>
        <h2>{{ heading() }}</h2>
        <p>
          {{ dateLabel() }} · {{ slot().startsAt }} a {{ slot().endsAt }}
          @if (slot().pendingMatch; as match) {
            · <b>{{ missing() }} · nivel {{ match.level }}</b>
          }
        </p>
      </div>
      <div class="slot-summary__actions">
        @if (slot().state === 'pending' && canReplacePending()) {
          <button class="slot-summary__cta" type="button" (click)="replacePending.emit()">
            Reservar como grupo completo
          </button>
        } @else {
        <a class="slot-summary__cta" routerLink="/ingresar">{{ ctaLabel() }}</a>
        }
        <button
          type="button"
          class="slot-summary__close"
          aria-label="Cerrar resumen del turno"
          (click)="closed.emit()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </section>
  `,
  styleUrl: './slot-summary.component.scss',
})
export class SlotSummaryComponent {
  readonly slot = input.required<GridSlot>();
  readonly courtName = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly closed = output<void>();
  readonly replacePending = output<void>();
  readonly canReplacePending = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Al elegir un turno, el resumen queda a la vista sin tapar la grilla.
    afterRenderEffect(() => {
      this.slot();
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
      this.host.nativeElement.scrollIntoView?.({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    });
  }

  readonly stateLabel = computed(() => SLOT_STATE_LABELS[this.slot().state]);
  readonly heading = computed(() => this.courtName());
  readonly missing = computed(() =>
    missingPlayersLabel(this.slot().pendingMatch?.missingPlayers ?? 0),
  );
  readonly ctaLabel = computed(() =>
    this.slot().state === 'pending' ? 'Ingresá para sumarte' : 'Ingresá para reservar',
  );
}
