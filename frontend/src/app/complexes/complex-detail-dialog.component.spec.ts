import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComplexDetailDialogComponent } from './complex-detail-dialog.component';
import { ComplexRecord } from './complex.model';

describe('modal de datos del complejo', () => {
  const complex = {
    id: 'complex-1',
    name: 'Club Norte',
    address: 'Calle 1',
    phone: '221 555 0000',
    zone: 'Gonnet',
    imageDataUrl: null,
    managerIds: ['m1'],
  } as unknown as ComplexRecord;

  async function render(canDelete: boolean) {
    await TestBed.configureTestingModule({
      imports: [ComplexDetailDialogComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ComplexDetailDialogComponent);
    fixture.componentRef.setInput('complex', complex);
    fixture.componentRef.setInput('managers', [{ id: 'm1', name: 'Ana Gómez' }]);
    fixture.componentRef.setInput('canDelete', canDelete);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra todos los datos y las acciones del complejo', async () => {
    const fixture = await render(true);
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    ['Club Norte', 'Calle 1', '221 555 0000', 'Gonnet', 'Ana Gómez'].forEach((value) => expect(text).toContain(value));
    const actions = [...root.querySelectorAll('.detail-actions > *')].map((item) => item.textContent?.trim());
    expect(actions).toEqual(['Administrar canchas', 'Ver agenda', 'Editar', 'Eliminar']);
    expect(root.querySelector('a[href="/admin/complejos/complex-1/canchas"]')).not.toBeNull();
    expect(root.querySelector('a[href="/admin/complejos/complex-1/agenda"]')).not.toBeNull();
    fixture.destroy();
  });

  it('oculta Eliminar si la cuenta no puede dar de baja', async () => {
    const fixture = await render(false);

    expect(fixture.nativeElement.querySelector('.action-danger')).toBeNull();
    fixture.destroy();
  });

  it('emite editar, eliminar y cerrar', async () => {
    const fixture = await render(true);
    const events: string[] = [];
    fixture.componentInstance.edit.subscribe(() => events.push('edit'));
    fixture.componentInstance.remove.subscribe(() => events.push('remove'));
    fixture.componentInstance.close.subscribe(() => events.push('close'));
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelectorAll('.detail-actions button')[0] as HTMLButtonElement).click();
    (root.querySelector('.action-danger') as HTMLButtonElement).click();
    (root.querySelector('.close-button') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(events).toEqual(['edit', 'remove', 'close', 'close']);
    fixture.destroy();
  });
});