import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupDetailsStepComponent } from './group-details-step.component';

describe('HU-06: formulario del grupo', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [GroupDetailsStepComponent] }).compileComponents();
    const fixture: ComponentFixture<GroupDetailsStepComponent> = TestBed.createComponent(GroupDetailsStepComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('emite un grupo incompleto hasta que se completan responsable, teléfono y los cuatro jugadores', async () => {
    const { fixture, component, root } = await render();
    const groups: unknown[] = [];
    component.groupChange.subscribe((group) => groups.push(group));

    expect(component.form.invalid).toBe(true);
    expect(root.querySelectorAll('input')).toHaveLength(6);
    component.form.setValue({
      responsibleName: 'Ana Martínez', contactPhone: '221 555-0101',
      player1: 'Ana Martínez', player2: 'Mateo Ruiz', player3: 'Lucía Díaz', player4: 'Juan Pérez',
    });
    expect(groups.at(-1)).toEqual({
      responsibleName: 'Ana Martínez', contactPhone: '221 555-0101',
      players: ['Ana Martínez', 'Mateo Ruiz', 'Lucía Díaz', 'Juan Pérez'],
    });
    fixture.destroy();
  });

  it('rechaza nombres y teléfonos compuestos solo por espacios', async () => {
    const { fixture, component } = await render();
    const groups: unknown[] = [];
    component.groupChange.subscribe((group) => groups.push(group));
    component.form.setValue({
      responsibleName: '   ', contactPhone: '        ',
      player1: '  ', player2: '  ', player3: '  ', player4: '  ',
    });

    expect(groups.at(-1)).toBeNull();
    expect(component.form.invalid).toBe(true);
    fixture.destroy();
  });

  it('emite exactamente los cuatro jugadores y el contacto responsable', async () => {
    const { fixture, component } = await render();
    const groups: unknown[] = [];
    component.groupChange.subscribe((group) => groups.push(group));
    component.form.setValue({
      responsibleName: ' Ana Martínez ',
      contactPhone: ' 221 555-0101 ',
      player1: ' Ana Martínez ',
      player2: 'Mateo Ruiz',
      player3: 'Lucía Díaz',
      player4: 'Juan Pérez',
    });

    expect(groups.at(-1)).toEqual({
      responsibleName: 'Ana Martínez',
      contactPhone: '221 555-0101',
      players: ['Ana Martínez', 'Mateo Ruiz', 'Lucía Díaz', 'Juan Pérez'],
    });
    fixture.destroy();
  });
});
