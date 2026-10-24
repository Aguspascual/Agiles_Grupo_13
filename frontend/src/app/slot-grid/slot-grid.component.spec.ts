import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlotGridComponent } from './slot-grid.component';
import { GridCourt, GridSlot } from './slot-grid.model';

function slot(
  id: string,
  startsAt: string,
  endsAt: string,
  state: GridSlot['state'],
  extra: Partial<GridSlot> = {},
): GridSlot {
  return {
    id,
    courtId: 'court-1',
    date: '2026-10-23',
    startsAt,
    endsAt,
    state,
    isPast: false,
    ...extra,
  };
}

const courts: GridCourt[] = [
  {
    id: 'court-1',
    name: 'Cancha 1',
    covered: true,
    slots: [
      slot('past', '08:00', '09:30', 'available', { isPast: true }),
      slot('free', '09:30', '11:00', 'available'),
      slot('pending', '11:00', '12:30', 'pending', {
        pendingMatch: { missingPlayers: 2, level: '5ta' },
      }),
      slot('reserved', '12:30', '14:00', 'reserved'),
    ],
  },
  {
    id: 'court-2',
    name: 'Cancha 2',
    covered: false,
    slots: [
      slot('blocked', '09:00', '10:00', 'blocked'),
      slot('class', '10:00', '11:00', 'class'),
    ],
  },
];

describe('HU-05: componente de grilla', () => {
  let fixture: ComponentFixture<SlotGridComponent>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SlotGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(SlotGridComponent);
    fixture.componentRef.setInput('courts', courts);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  it('muestra una columna por cancha con su tipo', () => {
    const headers = [...root.querySelectorAll('.slot-grid__court')].map((item) =>
      item.textContent?.trim(),
    );

    expect(headers).toEqual([
      expect.stringContaining('Cancha 1'),
      expect.stringContaining('Cancha 2'),
    ]);
    expect(headers[0]).toContain('Techada');
    expect(headers[1]).toContain('Descubierta');
  });

  it('distingue cada estado con su clase, su ícono y su texto', () => {
    expect(root.querySelector('.slot-cell.is-available:not(.is-past)')?.textContent).toContain(
      'Libre',
    );
    expect(root.querySelector('.slot-cell.is-reserved')?.textContent).toContain('Reservado');
    expect(root.querySelector('.slot-cell.is-class')?.textContent).toContain('Clase');
    expect(root.querySelector('.slot-cell.is-blocked')?.textContent).toContain('No disponible');
    expect(root.querySelectorAll('.slot-cell:not(.is-past) .slot-icon')).toHaveLength(5);
    const pending = root.querySelector('.slot-cell.is-pending');
    expect(pending?.textContent).toContain('Partido abierto');
    expect(pending?.textContent).toContain('Faltan 2 jugadores · 5ta');
  });

  it('solo permite elegir turnos futuros libres o con partido abierto', () => {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button.slot-cell')];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Cancha 1, 09:30 a 11:00, Libre',
      'Cancha 1, 11:00 a 12:30, Partido abierto, Faltan 2 jugadores, nivel 5ta',
    ]);
    const past = root.querySelector('.slot-cell.is-past');
    expect(past?.tagName).toBe('DIV');
    expect(past?.getAttribute('aria-label')).toContain('turno pasado');
  });

  it('avisa qué turno se eligió y lo marca como seleccionado', () => {
    const emitted: GridSlot[] = [];
    fixture.componentInstance.slotSelected.subscribe((value) => emitted.push(value));

    root.querySelector<HTMLButtonElement>('button.slot-cell.is-available')?.click();
    fixture.componentRef.setInput('selectedSlotId', 'free');
    fixture.detectChanges();

    expect(emitted.map((item) => item.id)).toEqual(['free']);
    expect(root.querySelector('button.is-selected')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('muestra los turnos pasados solo con su horario', () => {
    const past = root.querySelector('.slot-cell.is-past');

    expect(past?.querySelector('.slot-cell__time')?.textContent).toContain('08:00 a 09:30');
    expect(past?.getAttribute('aria-label')).toBe('Cancha 1, 08:00 a 09:30, Libre, turno pasado');
  });

  it('muestra un estado vacío cuando el día no tiene turnos', () => {
    fixture.componentRef.setInput('courts', [
      { id: 'court-1', name: 'Cancha 1', covered: true, slots: [] },
    ]);
    fixture.detectChanges();

    expect(root.querySelector('.slot-grid')).toBeNull();
    expect(root.textContent).toContain('No hay turnos para este día');
  });
});
