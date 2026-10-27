import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LandingPage } from './landing.page';
import { MatchSearchPage } from './match-search.page';
import { ClubDirectoryPage } from './club-directory.page';
import { routes } from '../app.routes';

describe('HU-00: landing pública', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage, MatchSearchPage, ClubDirectoryPage],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('presenta el hero y las secciones principales de Home', () => {
    const fixture: ComponentFixture<LandingPage> = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const heroTitle = root.querySelector('h1')?.textContent ?? '';
    expect(heroTitle).toContain('Encontrá tu próximo');
    expect(heroTitle).toContain('partido de pádel en La Plata');
    expect(root.querySelector('[data-home-search]')).not.toBeNull();
    expect(root.querySelector('[data-home-stats]')?.children.length).toBe(4);
    expect(root.querySelector('[data-home-stats]')?.textContent).toContain('CLUBES ASOCIADOS');
    expect(root.querySelector('[data-home-stats]')?.textContent).toContain(
      'CATEGORÍAS DISPONIBLES',
    );
    expect(root.querySelector('[data-home-stats]')?.textContent).toContain('2da a 8va');
    expect(root.textContent).not.toContain('Filtrado automático: 5ta División');
    expect(root.querySelector('[data-recommended-matches]')?.children.length).toBe(3);
    expect(root.textContent).not.toContain('COMUNIDAD OFICIAL PLATENSE');
    expect(
      [
        ...root.querySelectorAll(
          '[data-recommended-matches] [data-match-card], .available-grid [data-match-card]',
        ),
      ].every((card) => !!card.querySelector('img.match-card__image')?.getAttribute('src')),
    ).toBe(true);
    expect(root.querySelector('#recommended-title')?.className).toBe(
      root.querySelector('#available-title')?.className,
    );
    expect(root.querySelector('[data-featured-clubs]')?.children.length).toBe(3);
    expect(root.querySelector('a[href^="/partidos"]')?.textContent).toContain('Buscar partidos');
    expect(root.querySelector('a[href="/ingresar"]')).not.toBeNull();
    fixture.destroy();
  });

  it('presenta filtros laterales y partidos en Home 2', () => {
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Explorá partidos abiertos');
    expect(root.querySelector('[aria-label="Filtros de partidos"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-match-card]').length).toBeGreaterThanOrEqual(6);
    const matchCards = [...root.querySelectorAll('[data-match-card]')];
    expect(
      matchCards.every((card) => {
        const image = card.querySelector('img.match-card__image') as HTMLImageElement | null;
        return !!image?.getAttribute('src') && !!image.alt;
      }),
    ).toBe(true);
    expect(root.querySelector('.search-heading .eyebrow')).toBeNull();
    expect(root.querySelector('.search-stats')).toBeNull();
    expect(root.querySelector('[data-map-promo]')).not.toBeNull();
    fixture.destroy();
  });

  it('presenta un directorio público de clubes con búsqueda local', () => {
    const fixture = TestBed.createComponent(ClubDirectoryPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('Clubes de pádel en La Plata');
    expect(root.querySelector('.clubs-kicker')).toBeNull();
    expect(root.querySelectorAll('[data-club-card]').length).toBe(3);
    expect(root.querySelector('[data-club-card] img')).not.toBeNull();
    // HU-05: "Explorar turnos" abre la grilla de turnos del club.
    expect(root.querySelector('a[href="/clubes/complex-cumbre/turnos"]')?.textContent).toContain(
      'Explorar turnos',
    );

    const search = root.querySelector('input[aria-label="Buscar club"]') as HTMLInputElement;
    search.value = 'City Bell';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelectorAll('[data-club-card]').length).toBe(1);
    expect(root.querySelector('[data-club-card] h2')?.textContent).toContain('City Bell');
    search.value = 'club inexistente';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector('.clubs-empty h2')?.textContent).toContain('No encontramos clubes');
    fixture.destroy();
  });

  it('permite probar la acción de unirse sin enviar al login', () => {
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const action = root.querySelector('[data-match-action]') as HTMLButtonElement;

    expect(action).not.toBeNull();
    expect(root.querySelector('.match-card__bottom a[href="/ingresar"]')).toBeNull();
    action.click();
    fixture.detectChanges();
    expect(action.textContent).toContain('Solicitud enviada');
    fixture.destroy();
  });

  it('no muestra accesos directos de demo en Home', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-demo-links]')).toBeNull();
    fixture.destroy();
  });

  it('filtra partidos locales por zona y permite limpiar los filtros', () => {
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.componentInstance.selectedZones = ['City Bell'];
    expect(fixture.componentInstance.filteredMatches.length).toBe(1);
    expect(fixture.componentInstance.filteredMatches[0].zone).toBe('City Bell');

    fixture.componentInstance.clearFilters();
    expect(fixture.componentInstance.filteredMatches.length).toBe(7);
    fixture.destroy();
  });

  it('mantiene el acceso y el registro existentes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/ingresar');
    expect(router.url).toBe('/ingresar');
    await router.navigateByUrl('/registro');
    expect(router.url).toBe('/registro');
    await router.navigateByUrl('/clubes');
    expect(router.url).toBe('/clubes');
  });
});
