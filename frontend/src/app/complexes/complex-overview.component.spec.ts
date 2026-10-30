import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComplexOverviewComponent } from './complex-overview.component';

const complex = {
  id: 'c1',
  name: 'Club Norte',
  address: 'Calle 1',
  zone: 'Gonnet',
  phone: '221 555 0000',
  imageDataUrl: null,
  managerIds: ['m1'],
  managers: [{ id: 'm1', name: 'Ana Gómez', email: 'ana@example.com' }],
};

describe('vista completa del complejo', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ComplexOverviewComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function open(admin: boolean): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ComplexOverviewComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ComplexOverviewComponent);
    fixture.componentRef.setInput('complexId', 'c1');
    fixture.componentRef.setInput('courts', [{ id: 'k1', name: 'Cancha 1', covered: true }, { id: 'k2', name: 'Cancha 2', covered: false }]);
    fixture.componentRef.setInput('courtId', 'k1');
    fixture.detectChanges();
    http.expectOne('/api/v1/complexes').flush({ complexes: [complex] });
    const managers = http.expectOne('/api/v1/complexes/available-managers');
    if (admin) managers.flush({ managers: [{ id: 'm1', name: 'Ana Gómez', email: 'ana@example.com' }] });
    else managers.flush({ error: 'prohibido' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const expand = () => {
    (root().querySelector('.data-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('muestra los datos en una tarjeta desplegable cerrada por defecto', async () => {
    await open(true);
    expect(root().querySelector('.data-panel')).toBeNull();
    expect(root().querySelector('.data-toggle')?.getAttribute('aria-expanded')).toBe('false');

    expand();
    const text = root().textContent ?? '';
    ['Club Norte', 'Calle 1', '221 555 0000', 'Gonnet', 'Ana Gómez'].forEach((value) => expect(text).toContain(value));
    expect(root().querySelector('.data-toggle')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('ofrece editar datos y eliminar solo a administradores', async () => {
    await open(true);
    expand();
    const labels = [...root().querySelectorAll('.overview-actions button')].map((item) => item.textContent?.trim());
    expect(labels).toEqual(['Editar datos', 'Eliminar complejo']);
  });

  it('un encargado puede editar pero no eliminar el complejo', async () => {
    await open(false);
    expand();
    const labels = [...root().querySelectorAll('.overview-actions button')].map((item) => item.textContent?.trim());
    expect(labels).toEqual(['Editar datos']);
  });

  const pick = (label: string) => {
    (root().querySelector('.select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const option = [...root().querySelectorAll<HTMLElement>('.select-menu [role="option"]')].find((item) => item.textContent?.includes(label));
    option!.click();
    fixture.detectChanges();
  };

  it('lista las canchas en el selector y deja "Crear cancha" como última opción', async () => {
    await open(true);
    (root().querySelector('.select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const labels = [...root().querySelectorAll('.select-menu [role="option"]')].map((item) => item.textContent?.trim().replace(/^\+\s*/, ''));
    expect(labels).toEqual(['Cancha 1', 'Cancha 2', 'Crear cancha']);
    expect(root().querySelector('.court-kind')).toBeNull();
    expect(root().querySelector('.court-close')).toBeNull();
  });

  it('informa la cancha elegida a la página', async () => {
    await open(true);
    const chosen: string[] = [];
    fixture.componentInstance.courtIdChange.subscribe((id) => chosen.push(id));

    pick('Cancha 2');

    expect(chosen).toEqual(['k2']);
  });

  it('muestra Administrar horarios a la derecha del selector', async () => {
    await open(true);
    const toolbar = root().querySelector('.court-toolbar') as HTMLElement;
    const children = [...toolbar.children].map((item) => item.className.split(' ')[0]);
    expect(children).toEqual(['court-select', 'action']);
    expect(toolbar.querySelector('.action')?.textContent).toContain('Administrar horarios');
  });

  it('abre el modal de horarios de la cancha elegida', async () => {
    await open(true);
    (root().querySelector('.court-toolbar .action') as HTMLButtonElement).click();
    fixture.detectChanges();

    http.expectOne('/api/v1/complexes/c1/courts/k1/weekly-schedule/days').flush({ days: [] });
    expect(root().querySelector('app-court-schedule-dialog')).not.toBeNull();
    expect(root().querySelector('app-court-schedule-dialog')?.textContent).not.toContain('Horario semanal');
  });

  it('crea una cancha desde la última opción y la deja seleccionada', async () => {
    await open(true);
    const events: string[] = [];
    fixture.componentInstance.courtIdChange.subscribe((id) => events.push(`select:${id}`));
    fixture.componentInstance.courtsChanged.subscribe(() => events.push('reload'));
    fixture.componentInstance.notify.subscribe((message) => events.push(message));

    pick('Crear cancha');
    expect(root().querySelector('app-court-form-dialog')).not.toBeNull();

    fixture.componentInstance.saveCourt({ name: 'Cancha 3', covered: true, imageDataUrl: null, features: [] });
    const request = http.expectOne('/api/v1/complexes/c1/courts');
    expect(request.request.method).toBe('POST');
    request.flush({ court: { id: 'k3', complexId: 'c1', name: 'Cancha 3', covered: true, imageDataUrl: null, features: [] } }, { status: 201, statusText: 'Created' });
    await new Promise((resolve) => setTimeout(resolve, 600));
    fixture.detectChanges();

    expect(root().querySelector('app-court-form-dialog')).toBeNull();
    expect(events).toEqual(['select:k3', 'Cancha agregada.', 'reload']);
  });
});