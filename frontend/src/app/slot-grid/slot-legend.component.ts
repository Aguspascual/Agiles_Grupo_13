import { Component } from '@angular/core';
import { LEGEND_STATES, SLOT_STATE_LABELS } from './slot-grid.model';

/** Leyenda de los cuatro estados que ve el jugador. */
@Component({
  selector: 'app-slot-legend',
  template: `
    <ul class="slot-legend" aria-label="Referencias de estados">
      @for (item of items; track item.state) {
        <li [class]="'slot-badge is-' + item.state">
          <i class="slot-icon" aria-hidden="true"></i>{{ item.label }}
        </li>
      }
    </ul>
  `,
  styles: `
    .slot-legend {
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      list-style: none;
    }
  `,
})
export class SlotLegendComponent {
  readonly items = LEGEND_STATES.map((state) => ({ state, label: SLOT_STATE_LABELS[state] }));
}
