import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingPreviewStore } from '../bookings/booking-preview.store';
import { CLOCK } from '../slot-grid/slot-grid.service';
import { SlotSelectionStepComponent } from './slot-selection-step.component';

describe('HU-06: selección de turno', () => {
  async function render() {
    await TestBed.configureTestingModule({
      imports: [SlotSelectionStepComponent],
      providers: [{ provide: CLOCK, useValue: () => new Date(2026, 9, 27, 8, 0) }],
    }).compileComponents();
    const fixture: ComponentFixture<SlotSelectionStepComponent> = TestBed.createComponent(SlotSelectionStepComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, bookings: TestBed.inject(BookingPreviewStore) };
  }

  it('consulta el horario existente y solo ofrece slots disponibles futuros', async () => {
    const { fixture, component, bookings } = await render();
    component.changeComplex('complex-gonnet');
    fixture.detectChanges();

    expect(component.state().status).toBe('ok');
    expect(component.availableSlots().length).toBeGreaterThan(0);
    expect(component.availableSlots().every((slot) =>
      slot.state === 'available' && !slot.isPast && !bookings.bookingFor(slot),
    )).toBe(true);
    fixture.destroy();
  });

  it('emite la selección con complejo, cancha e intervalo del turno elegido', async () => {
    const { fixture, component } = await render();
    component.changeComplex('complex-gonnet');
    fixture.detectChanges();
    const selected: unknown[] = [];
    component.selectionChange.subscribe((selection) => selected.push(selection));
    const slot = component.availableSlots()[0];

    component.chooseSlot(slot);

    expect(selected[0]).toMatchObject({
      complexId: 'complex-gonnet',
      complexName: 'Club Universitario Gonnet',
      courtId: slot.courtId,
      slot: { id: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt },
    });
    fixture.destroy();
  });
});
