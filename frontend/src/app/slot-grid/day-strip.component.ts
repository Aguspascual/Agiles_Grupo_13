import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { addDays, capitalize, daysBetween, fromDateKey, toDateKey } from '../shared/local-date';

interface DayChip {
  key: string;
  top: string;
  bottom: string;
  fullLabel: string;
}

/** Selector de día: flechas para moverse de a un día y accesos directos a los próximos días. */
@Component({
  selector: 'app-day-strip',
  templateUrl: './day-strip.component.html',
  styleUrl: './day-strip.component.scss',
})
export class DayStripComponent {
  /** Día elegido, `AAAA-MM-DD`. */
  readonly selected = input.required<string>();
  /** Hoy, `AAAA-MM-DD`; no se puede elegir un día anterior. */
  readonly today = input.required<string>();
  /** Cantidad de días que se pueden consultar a partir de hoy. */
  readonly windowDays = input(14);
  readonly dateChange = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Mantiene visible el día elegido cuando la tira se desplaza (por ejemplo, en el celular).
    afterRenderEffect(() => {
      this.selected();
      const list = this.host.nativeElement.querySelector<HTMLElement>('.day-strip__days');
      const active = list?.querySelector<HTMLElement>('.day-chip.is-active');
      if (!list || !active) return;
      const start = active.offsetLeft;
      const end = start + active.offsetWidth;
      if (start < list.scrollLeft || end > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = Math.max(0, start - 8);
      }
    });
  }

  readonly chips = computed<DayChip[]>(() => {
    const today = fromDateKey(this.today());
    if (!today) return [];
    return Array.from({ length: this.windowDays() }, (_, offset) => {
      const date = addDays(today, offset);
      const weekday = date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
      const month = date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
      return {
        key: toDateKey(date),
        top: offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : capitalize(weekday),
        bottom: `${date.getDate()} ${month}`,
        fullLabel: capitalize(
          date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
        ),
      };
    });
  });

  private readonly offset = computed(() => {
    const today = fromDateKey(this.today());
    const selected = fromDateKey(this.selected());
    return today && selected ? daysBetween(today, selected) : 0;
  });

  readonly canGoBack = computed(() => this.offset() > 0);
  readonly canGoForward = computed(() => this.offset() < this.windowDays() - 1);

  shift(amount: number): void {
    const selected = fromDateKey(this.selected());
    if (!selected) return;
    if ((amount < 0 && !this.canGoBack()) || (amount > 0 && !this.canGoForward())) return;
    this.dateChange.emit(toDateKey(addDays(selected, amount)));
  }

  choose(key: string): void {
    if (key !== this.selected()) this.dateChange.emit(key);
  }
}
