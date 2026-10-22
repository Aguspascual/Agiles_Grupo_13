import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComplexAdminPage } from './complex-admin.page';

describe('administración de complejos', () => {
  it('ubica el botón Nuevo complejo en el encabezado sin avatar de usuario', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminPage);
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.topbar') as HTMLElement;

    expect(header.querySelector('.avatar')).toBeNull();
    expect(header.querySelector('.new-complex-button')?.textContent).toContain('Nuevo complejo');
    fixture.destroy();
  });
});
