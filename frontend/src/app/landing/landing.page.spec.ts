import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { ApiMatch } from '../matches/match-api.model';
import { PendingMatchMembershipCardComponent } from '../bookings/pending-match-membership-card.component';
import { LandingPage } from './landing.page';
import { PendingMatchMembershipStore } from '../bookings/pending-match-membership.store';
import { MatchSearchPage } from './match-search.page';
import { ClubDirectoryPage } from './club-directory.page';
import { routes } from '../app.routes';

/** Fija la hora del sistema para las pruebas del estado local de membresía. */
function setDemoClock(hours: number, minutes: number): void {
  TestBed.inject(PendingMatchMembershipStore).now = () => new Date(new Date().setHours(hours, minutes, 0, 0));
}

// Explicit API fixtures replace the demo matches removed from MatchSearchPage.
const apiMatches: ApiMatch[] = Array.from({ length: 7 }, (_, index) => ({
  id: `match-${index}`, status: 'open', complexId: `complex-${index}`,
  complex: `Test club ${index}`, address: 'Test address',
  zone: index === 0 ? 'City Bell' : 'Gonnet', courtId: `court-${index}`,
  court: 'Court 1', covered: true, lighting: true, date: '2026-11-02',
  startsAt: '20:30', endsAt: '21:30', targetLevel: '5ta', missingPlayers: 2,
  players: [
    { name: 'Test organizer', level: '5ta', position: 'Drive', organizer: true },
    { name: 'Test player', level: '5ta', position: 'Revés', organizer: false },
  ],
}));

function flushMatches(): void {
  TestBed.inject(HttpTestingController).expectOne('/api/v1/matches').flush({ matches: apiMatches });
}

describe('HU-00: landing pública', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage, MatchSearchPage, ClubDirectoryPage, PendingMatchMembershipCardComponent],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    sessionStorage.clear();
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

  it('presenta filtros laterales y partidos en Home 2', async () => {
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    flushMatches();
    await fixture.whenStable();
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
    const fixture = TestBed.createComponent(PendingMatchMembershipCardComponent);
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
    const fixture = TestBed.createComponent(PendingMatchMembershipCardComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.membership-card__eyebrow')?.textContent).toContain('TU TURNO COMPLETO');
    expect(root.querySelector('.membership-card__eyebrow')?.textContent).not.toContain('PENDIENTE');
    expect(root.querySelector<HTMLButtonElement>('.membership-card footer button')?.disabled).toBe(true);
    fixture.destroy();
  });

  it('abre el detalle y registra la participación autenticada mediante la API', async () => {
    vi.spyOn(TestBed.inject(AuthSessionService), 'restore').mockReturnValue(of({
      id: 'player-id', name: 'Test player', email: 'player@example.com', zone: 'Gonnet', level: '5ta',
    }));
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    flushMatches();
    await fixture.whenStable();
    fixture.detectChanges();
    const details = root.querySelector('[data-match-detail]') as HTMLButtonElement;

    expect(details).not.toBeNull();
    expect(root.querySelector('.match-card__bottom a[href="/ingresar"]')).toBeNull();
    details.click();
    fixture.detectChanges();
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Test club 0');
    expect(dialog?.textContent).toContain('Drive');

    root.querySelector<HTMLButtonElement>('.join-match-button')?.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.join-confirm-submit')?.click();
    fixture.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/matches/match-0/players');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ match: { ...apiMatches[0], missingPlayers: 1 } });
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Te sumaste al partido en Test club 0.');
    expect(fixture.componentInstance.matches()[0].openSpots).toBe(1);
    fixture.destroy();
  });

  it('no muestra accesos directos de demo en Home', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-demo-links]')).toBeNull();
    fixture.destroy();
  });

  it('filtra partidos de la API por zona y permite limpiar los filtros', () => {
    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
    flushMatches();
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
