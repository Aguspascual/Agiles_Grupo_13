import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { ComplexApiService } from '../complexes/complex-api.service';
import { MatchApiService } from '../matches/match-api.service';
import { MatchSearchPage } from './match-search.page';

describe('tarjeta de filtros de Buscar partidos', () => {
  async function render(listPublic: () => unknown) {
    await TestBed.configureTestingModule({
      imports: [MatchSearchPage],
      providers: [
        provideRouter([]),
        { provide: MatchApiService, useValue: { list: vi.fn(() => of([])) } },
        { provide: AuthSessionService, useValue: { restore: vi.fn(() => of(null)), currentUser: vi.fn(() => null) } },
        { provide: ComplexApiService, useValue: { listPublic } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const sidebar = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.querySelector('.filter-sidebar') as HTMLElement;

  it('no muestra el contador de filtros ni el interruptor de lugares libres', async () => {
    const fixture = await render(() => of([]));
    const text = sidebar(fixture).textContent ?? '';

    expect(text).not.toMatch(/\d+\s+activos?/);
    expect(text).not.toContain('Solo con lugares libres');
    expect(sidebar(fixture).querySelector('.open-toggle, [role="switch"]')).toBeNull();
    expect(text).toContain('Limpiar filtros');
  });

  it('lista los clubes registrados que trae la base de datos, aunque no tengan partidos', async () => {
    const fixture = await render(() => of([
      { id: 'c1', name: 'Club Berisso', address: 'Calle 60', zone: 'Berisso / Ensenada' },
      { id: 'c2', name: 'Club Don Pascual', address: 'Calle 11', zone: 'Casco Urbano' },
    ]));
    (sidebar(fixture).querySelector('.select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const options = [...sidebar(fixture).querySelectorAll('.select-menu [role="option"]')].map((item) => item.textContent?.trim());
    expect(options).toEqual(['Todos los clubes de La Plata', 'Club Berisso', 'Club Don Pascual']);
  });

  it('elegir un club actualiza el filtro y Limpiar filtros lo restablece', async () => {
    const fixture = await render(() => of([{ id: 'c1', name: 'Club Berisso', address: 'Calle 60', zone: 'Berisso / Ensenada' }]));
    const page = fixture.componentInstance;
    (sidebar(fixture).querySelector('.select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    ([...sidebar(fixture).querySelectorAll('.select-menu [role="option"]')][1] as HTMLElement).click();
    fixture.detectChanges();

    expect(page.selectedClub).toBe('Club Berisso');
    expect(sidebar(fixture).querySelector('.select-value')?.textContent).toContain('Club Berisso');
    page.clearFilters();
    expect(page.selectedClub).toBe('Todos los clubes de La Plata');
  });

  it('si falla la carga de clubes deja solo la opción de todos los clubes', async () => {
    const fixture = await render(() => throwError(() => new Error('sin conexión')));
    (sidebar(fixture).querySelector('.select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(sidebar(fixture).querySelectorAll('.select-menu [role="option"]')).toHaveLength(1);
  });
});