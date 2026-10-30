import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  TemplateRef,
  afterRenderEffect,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { minutesOfDay } from '../shared/local-date';
import { GridLayout, layoutFor, placementFor } from './slot-grid.builder';
import {
  GridCourt,
  GridSlot,
  SLOT_STATE_LABELS,
  describeSlot,
  isSelectable,
  missingPlayersLabel,
} from './slot-grid.model';

export interface SlotCellContext {
  $implicit: GridSlot;
  court: GridCourt;
}

interface PlacedSlot {
  slot: GridSlot;
  gridRow: string;
  selectable: boolean;
  label: string;
}

interface PlacedCourt {
  court: GridCourt;
  gridColumn: number;
  slots: PlacedSlot[];
}

/** Píxeles por minuto: un turno de 60 min mide 69 px y uno de 90 min, 103 px. */
const PX_PER_MINUTE = 1.15;
const HEADER_HEIGHT = 52;

/**
 * Grilla de canchas por horario. Es reutilizable: la agenda del complejo (HU-07) puede pasar su
 * propio contenido de celda con `cellTemplate` para mostrar quién reservó cada turno.
 */
@Component({
  selector: 'app-slot-grid',
  imports: [NgTemplateOutlet],
  templateUrl: './slot-grid.component.html',
  styleUrl: './slot-grid.component.scss',
})
export class SlotGridComponent {
  readonly courts = input.required<GridCourt[]>();
  readonly selectedSlotId = input<string | null>(null);
  /** Minuto del día actual cuando la grilla muestra hoy; la vista arranca en ese horario. */
  readonly nowMinute = input<number | null>(null);
  readonly cellTemplate = input<TemplateRef<SlotCellContext> | null>(null);
  /** Qué turnos se pueden elegir; la agenda (HU-07) también elige turnos reservados. */
  readonly selectable = input<(slot: GridSlot) => boolean>(isSelectable);
  readonly slotSelected = output<GridSlot>();

  readonly missingLabel = missingPlayersLabel;
  readonly headerHeight = HEADER_HEIGHT;

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly layout = computed<GridLayout | null>(() => layoutFor(this.courts()));
  readonly rowHeight = computed(() => (this.layout()?.step ?? 30) * PX_PER_MINUTE);
  readonly hourHeight = computed(() => 60 * PX_PER_MINUTE);

  readonly columns = computed<PlacedCourt[]>(() => {
    const layout = this.layout();
    if (!layout) return [];
    const isChoosable = this.selectable();
    return this.courts().map((court, index) => ({
      court,
      gridColumn: index + 2,
      slots: court.slots.map((slot) => {
        const { row, span } = placementFor(slot, layout);
        return {
          slot,
          gridRow: `${row + 1} / span ${span}`,
          selectable: isChoosable(slot),
          label: describeSlot(slot, court.name),
        };
      }),
    }));
  });

  /** Desplazamiento del horario actual desde el borde superior, o `null` si no corresponde. */
  readonly nowOffset = computed<number | null>(() => {
    const layout = this.layout();
    const minute = this.nowMinute();
    if (!layout || minute === null || minute < layout.startMinute || minute > layout.endMinute)
      return null;
    return HEADER_HEIGHT + (minute - layout.startMinute) * PX_PER_MINUTE;
  });

  constructor() {
    // Al cambiar de día, lleva la vista al momento actual o al primer turno que se puede reservar.
    afterRenderEffect(() => {
      const element = this.scroller()?.nativeElement;
      const layout = this.layout();
      if (!element || !layout) return;
      const firstOpen = this.courts()
        .flatMap((court) => court.slots)
        .filter(this.selectable())
        .map((slot) => minutesOfDay(slot.startsAt))
        .sort((left, right) => left - right)[0];
      const target =
        this.nowOffset() ??
        (firstOpen === undefined
          ? null
          : HEADER_HEIGHT + (firstOpen - layout.startMinute) * PX_PER_MINUTE);
      element.scrollTop = target === null ? 0 : Math.max(0, target - HEADER_HEIGHT - 24);
    });
  }

  stateLabel(slot: GridSlot): string {
    return SLOT_STATE_LABELS[slot.state];
  }

  select(placed: PlacedSlot): void {
    if (placed.selectable) this.slotSelected.emit(placed.slot);
  }
}
