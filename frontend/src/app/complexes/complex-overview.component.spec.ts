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
    fixture.componentRef.setInput('courts', [{ id: 'k1', name: 'Cancha 1', covered: true }]);
    fixture.detectChanges();
    http.expectOne('/api/v1/complexes').flush({ complexes: [complex] });
    const managers = http.expectOne('/api/v1/complexes/available-managers');
    if (admin) managers.flush({ managers: [{ id: 'm1', name: 'Ana Gómez', email: 'ana@example.com' }] });
    else managers.flush({ error: 'prohibido' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('muestra los datos del complejo y sus canchas', async () => {
    await open(true);
    const text = root().textContent ?? '';

    ['Club Norte', 'Calle 1', '221 555 0000', 'Gonnet', 'Ana Gómez', 'Cancha 1', 'Cubierta'].forEach((value) => expect(text).toContain(value));
    expect(root().querySelector('a[href="/admin/complejos/c1/canchas/k1/horarios"]')).not.toBeNull();
  });

  it('ofrece editar datos y eliminar solo a administradores', async () => {
    await open(true);
    const labels = [...root().querySelectorAll('.overview-actions button')].map((item) => item.textContent?.trim());
    expect(labels).toEqual(['Editar datos', 'Eliminar complejo']);
  });

  it('un encargado puede editar pero no eliminar el complejo', async () => {
    await open(false);
    const labels = [...root().querySelectorAll('.overview-actions button')].map((item) => item.textContent?.trim());
    expect(labels).toEqual(['Editar datos']);
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