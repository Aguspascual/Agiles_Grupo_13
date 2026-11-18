import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComplexApiService } from './complex-api.service';

describe('API de configuración del complejo (HU-21)', () => {
  let service: ComplexApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ComplexApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee la configuración de precio y seña con sus decimales exactos', () => {
    let price = '';
    service.list().subscribe((complexes) => { price = complexes[0].pricing.turnPrice; });

    http.expectOne('/api/v1/complexes').flush({ complexes: [{
      id: 'complex-1', name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221',
      managerIds: ['manager-1'], pricing: { turnPrice: '12500.50', depositEnabled: true, depositType: 'fixed', depositValue: '3500.25' },
    }] });

    expect(price).toBe('12500.50');
  });

  it('envía la configuración dentro del PUT existente', () => {
    const draft = {
      name: 'Club', address: 'Calle 1', zone: 'Gonnet', phone: '221', imageDataUrl: null, managerIds: ['manager-1'],
      pricing: { turnPrice: '12500.50', depositEnabled: true, depositType: 'percentage' as const, depositValue: '12.75' },
    };
    service.update('complex-1', draft).subscribe();

    const request = http.expectOne('/api/v1/complexes/complex-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.pricing).toEqual(draft.pricing);
    request.flush({ complex: {
      id: 'complex-1', name: draft.name, address: draft.address, zone: draft.zone, phone: draft.phone,
      managerIds: draft.managerIds, pricing: draft.pricing,
    } });
  });
});
