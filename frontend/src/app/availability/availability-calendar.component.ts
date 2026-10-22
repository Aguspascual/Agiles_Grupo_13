import { Component, computed, input, output } from '@angular/core';
import { AvailabilitySlot } from './availability.model';

interface AvailabilityDay {
  date: string;
  label: string;
  slots: AvailabilitySlot[];
}

@Component({
  selector: 'app-availability-calendar',
  standalone: true,
  templateUrl: './availability-calendar.component.html',
  styleUrl: './availability-calendar.component.scss',
})
export class AvailabilityCalendarComponent {
  readonly slots = input<AvailabilitySlot[]>([]);
  readonly toggleBlocked = output<string>();
  readonly days = computed(() => groupSlotsByDate(this.slots()));

  toggle(slot: AvailabilitySlot): void {
    this.toggleBlocked.emit(slot.id);
  }
}

function groupSlotsByDate(slots: AvailabilitySlot[]): AvailabilityDay[] {
  const groups = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const group = groups.get(slot.date) ?? [];
    group.push(slot);
    groups.set(slot.date, group);
  }

  return [...groups.entries()].map(([date, daySlots]) => ({
    date,
    label: formatDateLabel(date),
    slots: daySlots,
  }));
}

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const label = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toLocaleUpperCase('es-AR') + label.slice(1);
}
