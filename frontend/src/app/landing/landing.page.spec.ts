import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LandingPage } from './landing.page';
import { PendingMatchMembershipStore } from '../bookings/pending-match-membership.store';
import { MatchSearchPage } from './match-search.page';
import { ClubDirectoryPage } from './club-directory.page';
import { routes } from '../app.routes';

/** Fija la hora del sistema para las pruebas del estado local de membresía. */
function setDemoClock(hours: number, minutes: number): void {
  TestBed.inject(PendingMatchMembershipStore).now = () => new Date(new Date().setHours(hours, minutes, 0, 0));
}

describe('HU-00: landing pública', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage, MatchSearchPage, ClubDirectoryPage],
      providers: [provideRouter(routes), provideHttpClient()],
    }).compileComponents();
  });

  it('presenta el hero y el buscador sin insertar datos de demostración', () => {
    const fixture: ComponentFixture<LandingPage> = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const heroTitle = root.querySelector('h1')?.textContent ?? '';
    expect(heroTitle).toContain('Encontrá tu próximo');
    expect(heroTitle).toContain('partido de pádel en La Plata');
    expect(root.querySelector('[data-home-search]')).not.toBeNull();
    expect(root.textContent).toContain('Cargando complejos y partidos');
    expect(root.querySelector('[data-home-stats]')).toBeNull();
    expect(root.querySelectorAll('[data-match-card]').length).toBe(0);
    expect(root.querySelectorAll('.club-card').length).toBe(0);
    expect(root.textContent).not.toContain('1.250+');
    expect(root.textContent).not.toContain('La Cumbre Pádel');
    expect(root.querySelector('a[href^="/partidos"]')?.textContent).toContain('Buscar partidos');
    expect(root.querySelector('.home-search__advanced')).toBeNull();
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

  it('simula bajarse de un partido completo y libera un lugar al confirmar', () => {
    setDemoClock(10, 0);
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.membership-card__occupancy')?.textContent).toContain('4/4');
    root.querySelector<HTMLButtonElement>('.membership-card footer button')?.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alertdialog"]')?.textContent).toContain(
      '¿Querés bajarte del partido?',
    );

    root.querySelector<HTMLButtonElement>('.membership-dialog__cancel')?.click();
    fixture.detectChanges();
    expect(root.querySelector('.membership-card__occupancy')?.textContent).toContain('4/4');

    root.querySelector<HTMLButtonElement>('.membership-card footer button')?.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.membership-dialog__confirm')?.click();
    fixture.detectChanges();
    expect(root.querySelector('.membership-card__occupancy')?.textContent).toContain('3/4');
    expect(root.querySelector('.membership-card__vacancy')?.textContent).toContain('Falta 1 jugador');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Te bajaste del partido');
    fixture.destroy();
  });

  it('RN-03: con menos de 2 horas la baja queda deshabilitada y el título refleja el estado', () => {
    setDemoClock(19, 0);
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.membership-card__eyebrow')?.textContent).toContain('TU TURNO COMPLETO');
    expect(root.querySelector('.membership-card__eyebrow')?.textContent).not.toContain('PENDIENTE');
    expect(root.querySelector<HTMLButtonElement>('.membership-card footer button')?.disabled).toBe(true);
    fixture.destroy();
  });

  it('abre el detalle del partido y permite unirse sin enviar al login', () => {
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const details = root.querySelector('[data-match-detail]') as HTMLButtonElement;

    expect(details).not.toBeNull();
    expect(root.querySelector('.match-card__bottom a[href="/ingresar"]')).toBeNull();
    details.click();
    fixture.detectChanges();
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Club Universitario Gonnet');
    expect(dialog?.textContent).toContain('Drive');

    root.querySelector<HTMLButtonElement>('.join-match-button')?.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.join-confirm-submit')?.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Solicitud para unirte enviada');
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
