import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('HU-01: registro e inicio de sesión', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  async function open(path: string): Promise<{ root: HTMLElement; fixture: ComponentFixture<App> }> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(path);
    await fixture.whenStable();
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, fixture };
  }

  function fill(root: HTMLElement, name: string, value: string): void {
    const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('muestra el acceso a la cuenta desde la ruta de ingreso', async () => {
    const { root } = await open('/ingresar');
    expect(root.textContent).toContain('Volvé a la cancha');
    expect(root.querySelector('input[name="email"]')).not.toBeNull();
    expect(root.querySelector('input[name="password"]')).not.toBeNull();
    expect(root.querySelector('a[href="/registro"]')).not.toBeNull();
  });

  it('marca los campos vacíos y no simula una sesión', async () => {
    const { root, fixture } = await open('/ingresar');
    const form = root.querySelector('form');
    expect(form).not.toBeNull();
    if (!form) return;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(root.textContent).toContain('Ingresá tu correo electrónico');
    expect(root.textContent).toContain('Ingresá tu contraseña');
    expect(root.textContent).not.toContain('Formulario listo para conectar');
  });

  it('avisa que el ingreso válido está listo para conectar al backend', async () => {
    const { root, fixture } = await open('/ingresar');
    fill(root, 'email', 'jugadora@example.com');
    fill(root, 'password', 'claveSegura123');
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(root.textContent).toContain('Formulario listo para conectar');
    expect(TestBed.inject(Router).url).toBe('/ingresar');
  });

  it('rechaza contraseñas distintas en el registro', async () => {
    const { root, fixture } = await open('/registro');
    fill(root, 'name', 'Ana Pérez');
    fill(root, 'email', 'ana@example.com');
    fill(root, 'password', 'claveSegura123');
    fill(root, 'confirmPassword', 'otraClave123');
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(root.textContent).toContain('Las contraseñas no coinciden');
    expect(root.textContent).not.toContain('Formulario listo para conectar');
  });
});
