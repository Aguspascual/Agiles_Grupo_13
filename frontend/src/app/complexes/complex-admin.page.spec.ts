import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ComplexAdminPage } from './complex-admin.page';
import { ComplexApiService } from './complex-api.service';

describe('administración de complejos', () => {
  it('ubica el botón Nuevo complejo en el encabezado sin avatar de usuario', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminPage],
      providers: [
        provideRouter([]),
        { provide: ComplexApiService, useValue: { list: () => of([]), availableManagers: () => of([]) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.topbar') as HTMLElement;

    expect(header.querySelector('.avatar')).toBeNull();
    expect(header.querySelector('.new-complex-button')?.textContent).toContain('Nuevo complejo');
    fixture.destroy();
  });
});
