import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComplexCardComponent } from './complex-card.component';
import { ComplexRecord } from './complex.model';

describe('tarjeta de complejo', () => {
  const complex = {
    id: 'complex-1',
    name: 'Club Norte',
    address: 'Calle 1',
    phone: '221 555 0000',
    zone: 'Gonnet',
    managerIds: [],
  } as unknown as ComplexRecord;

  async function render(canManage: boolean) {
    await TestBed.configureTestingModule({
      imports: [ComplexCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ComplexCardComponent);
    fixture.componentRef.setInput('complex', complex);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    return fixture;
  }

  it('ofrece Ver agenda junto a Administrar canchas', async () => {
    const fixture = await render(true);
    const links = [...fixture.nativeElement.querySelectorAll('.card-actions a')] as HTMLAnchorElement[];

    expect(links.map((link) => link.textContent?.trim())).toEqual(['Administrar canchas', 'Ver agenda']);
    expect(links[1].getAttribute('href')).toBe('/admin/complejos/complex-1/agenda');
    fixture.destroy();
  });

  it('no muestra acciones de gestión sin permiso', async () => {
    const fixture = await render(false);

    expect(fixture.nativeElement.querySelector('.card-actions')).toBeNull();
    fixture.destroy();
  });
});