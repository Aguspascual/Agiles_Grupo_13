import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ClubDirectoryPage } from './club-directory.page';

const URL = '/api/v1/public/complexes';
const CLUBS = [
  { id: 'a1', name: 'La Cumbre', address: 'Calle 1', zone: 'Gonnet' },
  { id: 'b2', name: 'City Hub', address: 'Calle 2', zone: 'City Bell' },
  { id: 'c3', name: 'Estudiantes', address: 'Calle 3', zone: 'Gonnet' },
];

describe('HU-05: directorio de clubes', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ClubDirectoryPage>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClubDirectoryPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClubDirectoryPage);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  const cards = () => [...root.querySelectorAll('[data-club-card]')];
  const answer = (clubs: unknown[]) => {
    http.expectOne(URL).flush({ complexes: clubs });
    fixture.detectChanges();
  };

  it('lista los clubes con enlace a su grilla y zonas salidas de los datos', () => {
    expect(root.textContent).toContain('Cargando clubes');
    answer(CLUBS);

    expect(cards()).toHaveLength(3);
    expect(cards()[0].textContent).toContain('Calle 1 · Gonnet');
    expect(cards()[0].querySelector('a')?.getAttribute('href')).toBe('/clubes/a1/turnos');
    expect(fixture.componentInstance.zones()).toEqual(['Todas las zonas', 'City Bell', 'Gonnet']);
    expect(root.textContent).not.toContain('★');
  });

  it('filtra por texto y por zona exacta', () => {
    answer(CLUBS);
    const page = fixture.componentInstance;

    page.searchTerm.set('cumbre');
    fixture.detectChanges();
    expect(cards()).toHaveLength(1);

    page.searchTerm.set('');
    page.selectedZone.set('Gonnet');
    fixture.detectChanges();
    expect(cards()).toHaveLength(2);

    page.searchTerm.set('zzz');
    fixture.detectChanges();
    expect(root.textContent).toContain('No encontramos clubes');
  });

  it('muestra el error y vuelve a consultar al reintentar', () => {
    http.expectOne(URL).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(root.textContent).toContain('No pudimos cargar los clubes');

    root.querySelector<HTMLButtonElement>('.clubs-empty button')?.click();
    answer(CLUBS);
    expect(cards()).toHaveLength(3);
  });

  it('informa cuando todavía no hay clubes adheridos', () => {
    answer([]);
    expect(cards()).toHaveLength(0);
    expect(root.textContent).toContain('Todavía no hay clubes adheridos.');
  });
});
