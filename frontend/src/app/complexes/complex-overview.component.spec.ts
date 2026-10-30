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

  it('elige la cancha en un selector y lo informa a la página', async () => {
    await open(true);
    const select = root().querySelector('.court-select select') as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent?.trim())).toEqual(['Cancha 1', 'Cancha 2']);
    const chosen: string[] = [];
    fixture.componentInstance.courtIdChange.subscribe((id) => chosen.push(id));

    select.value = 'k2';
    select.dispatchEvent(new Event('change'));

    expect(chosen).toEqual(['k2']);
  });

  it('abre el modal de horarios de la cancha elegida', async () => {
    await open(true);
    const button = [...root().querySelectorAll('.court-actions button')].find((item) => item.textContent?.includes('Administrar horarios')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    http.expectOne('/api/v1/complexes/c1/courts/k1/weekly-schedule/days').flush({ days: [] });
    expect(root().querySelector('app-court-schedule-dialog')).not.toBeNull();
    expect(root().textContent).toContain('Cancha 1');
  });
  it('cierra una cancha tras confirmar y avisa a la página', async () => {
    await open(true);
    const events: string[] = [];
    fixture.componentInstance.courtsChanged.subscribe(() => events.push('reload'));
    fixture.componentInstance.notify.subscribe((message) => events.push(message));

    (root().querySelector('.court-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root().textContent).toContain('¿Cerrar Cancha 1?');
    (root().querySelector('app-confirm-dialog .danger-button') as HTMLButtonElement).click();

    const request = http.expectOne('/api/v1/complexes/c1/courts/k1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(events).toEqual(['Cancha 1 se cerró correctamente.', 'reload']);
  });

  it('explica por qué no se puede cerrar una cancha con reservas futuras', async () => {
    await open(true);
    const events: string[] = [];
    fixture.componentInstance.notify.subscribe((message) => events.push(message));

    (root().querySelector('.court-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    (root().querySelector('app-confirm-dialog .danger-button') as HTMLButtonElement).click();
    http.expectOne('/api/v1/complexes/c1/courts/k1').flush({ error: 'reservas' }, { status: 409, statusText: 'Conflict' });

    expect(events).toEqual(['No se puede cerrar esta cancha: tiene reservas futuras.']);
  });
});