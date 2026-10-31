import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AllCourtsPage } from './all-courts.page';

const complex = (id: string, name: string, zone: string) => ({
  id, name, address: 'Calle 1', zone, phone: '221', imageDataUrl: null, managerIds: [],
});
const court = (id: string, complexId: string, name: string, covered: boolean) => ({
  id, complexId, name, covered, imageDataUrl: null, features: [],
});

describe('todas las canchas', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AllCourtsPage>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AllCourtsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AllCourtsPage);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lista las canchas de todos los complejos agrupadas por complejo', async () => {
    await render();
    http.expectOne('/api/v1/complexes').flush({ complexes: [complex('c1', 'Club Norte', 'Gonnet'), complex('c2', 'Club Sur', 'Tolosa')] });
    http.expectOne('/api/v1/complexes/c1/courts').flush({ courts: [court('k1', 'c1', 'Cancha 1', true), court('k2', 'c1', 'Cancha 2', false)] });
    http.expectOne('/api/v1/complexes/c2/courts').flush({ courts: [court('k3', 'c2', 'Cancha A', true)] });
    await fixture.whenStable();
    fixture.detectChanges();

    const groups = [...root().querySelectorAll('.complex-group')];
    expect(groups.map((group) => group.querySelector('h2')?.textContent)).toEqual(['Club Norte', 'Club Sur']);
    expect(groups[0].querySelectorAll('app-court-card')).toHaveLength(2);
    expect(groups[1].querySelectorAll('app-court-card')).toHaveLength(1);
    expect(root().querySelector('.count-chip')?.textContent).toContain('3 canchas en 2 complejos');
    expect(root().querySelector('a.group-link')?.getAttribute('href')).toBe('/admin/complejos/c1');
  });

  it('avisa cuando un complejo no tiene canchas o no se pudieron cargar', async () => {
    await render();
    http.expectOne('/api/v1/complexes').flush({ complexes: [complex('c1', 'Club Norte', 'Gonnet'), complex('c2', 'Club Sur', 'Tolosa')] });
    http.expectOne('/api/v1/complexes/c1/courts').flush({ courts: [] });
    http.expectOne('/api/v1/complexes/c2/courts').flush({ error: 'x' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const empties = [...root().querySelectorAll('.group-empty')].map((item) => item.textContent?.trim());
    expect(empties).toEqual(['Este complejo todavía no tiene canchas.', 'No pudimos cargar las canchas de este complejo.']);
  });

  it('muestra un error con reintento si falla el listado de complejos', async () => {
    await render();
    http.expectOne('/api/v1/complexes').flush({ error: 'x' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar las canchas');
    (root().querySelector('.all-courts-message button') as HTMLButtonElement).click();
    http.expectOne('/api/v1/complexes').flush({ complexes: [] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root().textContent).toContain('No hay complejos disponibles');
  });

  it('la tarjeta en solo lectura ofrece Horarios y Administrar canchas, sin editar ni dar de baja', async () => {
    await render();
    http.expectOne('/api/v1/complexes').flush({ complexes: [complex('c1', 'Club Norte', 'Gonnet')] });
    http.expectOne('/api/v1/complexes/c1/courts').flush({ courts: [court('k1', 'c1', 'Cancha 1', true)] });
    await fixture.whenStable();
    fixture.detectChanges();

    (root().querySelector('.actions-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = [...root().querySelectorAll('.actions-menu [role="menuitem"]')].map((item) => item.textContent?.trim());
    expect(items).toEqual(['Horarios', 'Administrar canchas']);
  });
});