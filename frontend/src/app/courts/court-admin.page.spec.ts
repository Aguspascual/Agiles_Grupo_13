import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CourtAdminPage } from './court-admin.page';
import { CourtRecord } from './court.model';

const URL = '/api/v1/complexes/c1/courts';
const record: CourtRecord = {
  id: 'a', complexId: 'c1', name: 'Cancha 1', covered: true, imageDataUrl: null, features: [],
};

describe('HU-03: administración de canchas por API', () => {
  async function render() {
    const paramMap = convertToParamMap({ complexId: 'c1' });
    await TestBed.configureTestingModule({
      imports: [CourtAdminPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap }, paramMap: of(paramMap) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CourtAdminPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/complexes').flush({
      complexes: [{ id: 'c1', name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '1', managerIds: [] }],
    });
    http.expectOne(URL).flush({ courts: [record] });
    fixture.detectChanges();
    return { fixture, http, page: fixture.componentInstance };
  }

  it('muestra un toast de reservas futuras en 409 y deja la cancha', async () => {
    const { fixture, http, page } = await render();
    page.requestDelete(record);
    page.confirmDelete();
    http.expectOne(`${URL}/a`).flush({ error: 'future reservations exist' }, { status: 409, statusText: 'Conflict' });

    expect(page.toastMessage()).toBe('No se puede dar de baja esta cancha: tiene reservas futuras.');
    expect(page.courts()).toHaveLength(1);
    fixture.destroy();
  });

  it('mantiene el formulario abierto cuando el backend responde 400', async () => {
    const { fixture, http, page } = await render();
    page.openCreate();
    page.save({ name: 'X', covered: false, imageDataUrl: null, features: [] });
    http.expectOne(URL).flush({ error: 'invalid court' }, { status: 400, statusText: 'Bad Request' });

    expect(page.formOpen()).toBe(true);
    expect(page.formClosing()).toBe(false);
    expect(page.saving()).toBe(false);
    expect(page.toastMessage()).toBe('Revisá los datos de la cancha.');
    fixture.destroy();
  });
});
