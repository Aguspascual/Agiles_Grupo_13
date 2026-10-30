import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSessionService } from '../auth/auth-session.service';
import { ComplexAdminSidebarComponent } from './complex-admin-sidebar.component';

describe('sidebar de administración', () => {
  it('ofrece navegación a complejos y canchas', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.componentRef.setInput('complexId', 'complex-centro');
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
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.componentRef.setInput('complexId', 'complex-centro');
    fixture.detectChanges();
    const courtsLink = fixture.nativeElement.querySelector('.courts-nav') as HTMLAnchorElement;

    expect(courtsLink).not.toBeNull();
    expect(courtsLink.getAttribute('href')).toBe('/admin/complejos/complex-centro/canchas');
    fixture.destroy();
  });

  it('ofrece Agenda con el complejo abierto y no muestra remanentes de demo', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.componentRef.setInput('complexId', 'complex-centro');
    fixture.detectChanges();
    const agenda = fixture.nativeElement.querySelector('.agenda-nav') as HTMLAnchorElement;

    expect(agenda.getAttribute('href')).toBe('/admin/complejos/complex-centro/agenda');
    expect(fixture.nativeElement.querySelector('.role-switcher')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Panel de demo');
    fixture.destroy();
  });

  it('cierra la sesión y navega a ingresar desde Cerrar sesión', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const session = TestBed.inject(AuthSessionService);
    const logout = vi.spyOn(session, 'logout');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.logout-link') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent).toContain('Cerrar sesión');
    button.click();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/ingresar');
    fixture.destroy();
  });
  it('oculta Canchas mientras no hay un complejo abierto', async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexAdminSidebarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComplexAdminSidebarComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.courts-nav')).toBeNull();
    fixture.destroy();
  });
});
