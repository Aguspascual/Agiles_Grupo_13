import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComplexAdminSidebarComponent } from './complex-admin-sidebar.component';

describe('sidebar de administración', () => {
  it('ofrece navegación a complejos y canchas', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.detectChanges();
    const navigation = fixture.nativeElement.querySelectorAll('.nav-item');
    const labels = [...navigation].map((item: Element) => item.textContent?.trim());

    expect(labels.some((label) => label?.includes('Complejos'))).toBe(true);
    expect(labels.some((label) => label?.includes('Canchas'))).toBe(true);
    fixture.destroy();
  });

  it('dirige Canchas al complejo abierto', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.componentRef.setInput('complexId', 'complex-centro');
    fixture.detectChanges();
    const courtsLink = fixture.nativeElement.querySelector('.courts-nav') as HTMLAnchorElement;

    expect(courtsLink).not.toBeNull();
    expect(courtsLink.getAttribute('href')).toBe('/admin/complejos/complex-centro/canchas');
    fixture.destroy();
  });

  it('muestra la simulación de roles al pie y ofrece cerrar sesión', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.componentRef.setInput('showRoleSimulation', true);
    fixture.componentRef.setInput('managers', [
      { id: 'manager-1', name: 'Valentina', email: 'valen@example.com' },
    ]);
    fixture.detectChanges();

    let emittedRole = '';
    fixture.componentInstance.roleChange.subscribe((role) => (emittedRole = role));
    const roleSelect = fixture.nativeElement.querySelector('#demo-role') as HTMLSelectElement;
    expect(roleSelect).not.toBeNull();
    roleSelect.value = 'manager';
    roleSelect.dispatchEvent(new Event('change'));
    expect(emittedRole).toBe('manager');
    fixture.componentRef.setInput('role', 'manager');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#demo-manager')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.logout-link')?.textContent).toContain('Cerrar sesión');
    fixture.destroy();
  });
});
