import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { LandingPage } from './landing.page';
import { ComplexApiService } from '../complexes/complex-api.service';
import { PublicComplex } from '../complexes/complex.model';
import { MatchApiService } from '../matches/match-api.service';
import { MatchPreview } from './landing.data';
import { AuthSessionService } from '../auth/auth-session.service';
import { ProfileFeedbackStore } from '../profile/profile-feedback.store';

describe('HU-00: Inicio con datos de API', () => {
  let complexes$: Subject<PublicComplex[]>;
  let matches$: Subject<MatchPreview[]>;
  let fixture: ComponentFixture<LandingPage>;

  const complex: PublicComplex = {
    id: 'complex-real-1',
    name: 'Complejo Real',
    address: 'Calle 10 y 20',
    zone: 'Gonnet',
  };

  const match: MatchPreview = {
    id: 'match-real-1',
    date: '2026-10-31',
    day: 'Mañana',
    time: '19:00 hs',
    duration: '90 min',
    club: complex.name,
    courtName: 'Cancha 2',
    image: '/images/cancha-interior.jpg',
    imageAlt: 'Cancha 2',
    address: complex.address,
    zone: complex.zone,
    level: '5ta',
    price: '',
    openSpots: 2,
    players: [],
    features: ['Techado'],
  };

  beforeEach(async () => {
    complexes$ = new Subject<PublicComplex[]>();
    matches$ = new Subject<MatchPreview[]>();
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        provideRouter([]),
        { provide: ComplexApiService, useValue: { listPublic: vi.fn(() => complexes$) } },
        { provide: MatchApiService, useValue: { list: vi.fn(() => matches$) } },
        { provide: AuthSessionService, useValue: { currentUser: signal(null) } },
        { provide: ProfileFeedbackStore, useValue: { saveNotice: signal(''), clear: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
  });

  it('carga clubes y partidos reales y deriva indicadores de esos resultados', () => {
    expect(fixture.nativeElement.textContent).toContain('Cargando');
    complexes$.next([complex]);
    complexes$.complete();
    matches$.next([match]);
    matches$.complete();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Complejo Real');
    expect(root.textContent).toContain('Calle 10 y 20');
    expect(root.textContent).toContain('1');
    expect(root.querySelector('[data-match-card="match-real-1"]')).not.toBeNull();
    expect(root.querySelector('[data-match-card] img.match-card__image')).toBeNull();
    expect(root.querySelector('.home-search__advanced')).toBeNull();
    expect(root.textContent).not.toContain('1.250+');
    expect(root.textContent).not.toContain('La Cumbre Pádel');
  });

  it('muestra estados vacíos cuando las APIs no tienen contenido', () => {
    complexes$.next([]);
    complexes$.complete();
    matches$.next([]);
    matches$.complete();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Todavía no hay complejos publicados');
    expect(root.textContent).toContain('Todavía no hay partidos abiertos');
    expect(root.querySelectorAll('[data-match-card]').length).toBe(0);
    expect(root.querySelectorAll('.club-card').length).toBe(0);
  });

  it('informa un error de API y ofrece reintentar', () => {
    complexes$.error(new Error('network unavailable'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar la información');
    expect(root.querySelector('[role="alert"] button')?.textContent).toContain('Reintentar');
  });
});
