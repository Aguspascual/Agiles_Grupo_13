import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { LandingPage } from './landing.page';
import { ComplexApiService } from '../complexes/complex-api.service';
import { PublicComplex, PublicCourt } from '../complexes/complex.model';
import { MatchApiService } from '../matches/match-api.service';
import { MatchPreview } from './landing.data';
import { AuthSessionService } from '../auth/auth-session.service';
import { ProfileFeedbackStore } from '../profile/profile-feedback.store';

describe('HU-00: Inicio con datos de API', () => {
  let complexes$: Subject<PublicComplex[]>;
  let matches$: Subject<MatchPreview[]>;
  let courts$: Subject<PublicCourt[]>;
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
    courts$ = new Subject<PublicCourt[]>();
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        provideRouter([]),
        { provide: ComplexApiService, useValue: { listPublic: vi.fn(() => complexes$), listPublicCourts: vi.fn(() => courts$) } },
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
    courts$.next([]);
    courts$.complete();
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
    courts$.next([]);
    courts$.complete();
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

  describe('canchas y complejos con imagen', () => {
    const courts: PublicCourt[] = [
      { id: 'k1', name: 'Cancha 1', covered: true, features: ['wifi', 'lighting'], imageUrl: '/api/v1/public/courts/k1/image?v=1', complexId: 'complex-real-1', complexName: 'Complejo Real', complexZone: 'Gonnet', complexAddress: 'Calle 10 y 20' },
      { id: 'k2', name: 'Cancha 2', covered: false, features: [], complexId: 'complex-real-1', complexName: 'Complejo Real', complexZone: 'Gonnet', complexAddress: 'Calle 10 y 20' },
    ];

    function load(): HTMLElement {
      complexes$.next([{ ...complex, imageUrl: '/api/v1/public/complexes/complex-real-1/image?v=1' }]);
      complexes$.complete();
      matches$.next([]);
      matches$.complete();
      courts$.next(courts);
      courts$.complete();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('la tarjeta de complejo registrado es un carrusel con las canchas, su imagen y su información', () => {
      const root = load();
      const slides = [...root.querySelectorAll('.featured-court .slide')] as HTMLElement[];

      expect(slides).toHaveLength(2);
      expect(slides[0].querySelector('img')?.getAttribute('src')).toBe('/api/v1/public/courts/k1/image?v=1');
      expect(slides[0].textContent).toContain('Cancha 1');
      expect(slides[0].textContent).toContain('Techada');
      expect(slides[0].textContent).toContain('Complejo Real');
      expect(slides[0].textContent).toContain('Wi-Fi');
      // La cancha sin imagen propia usa la del complejo.
      expect(slides[1].querySelector('img')?.getAttribute('src')).toBe('/api/v1/public/complexes/complex-real-1/image?v=1');
      expect(slides[0].querySelector('a')?.getAttribute('href')).toBe('/clubes/complex-real-1/turnos');
      expect(root.querySelectorAll('.slides__dots button')).toHaveLength(2);
    });

    it('permite pasar de cancha con las flechas y los puntos', () => {
      const root = load();
      const active = () => [...root.querySelectorAll('.featured-court .slide')].findIndex((slide) => slide.classList.contains('is-active'));
      expect(active()).toBe(0);

      (root.querySelector('.slides__nav--next') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(active()).toBe(1);

      (root.querySelector('.slides__nav--next') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(active()).toBe(0);

      (root.querySelectorAll('.slides__dots button')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(active()).toBe(1);
    });

    it('Complejos publicados muestra la imagen de cada complejo con su dirección y cantidad de canchas', () => {
      const root = load();
      const card = root.querySelector('.club-card') as HTMLElement;

      expect(card.querySelector('img')?.getAttribute('src')).toBe('/api/v1/public/complexes/complex-real-1/image?v=1');
      expect(card.textContent).toContain('Complejo Real');
      expect(card.textContent).toContain('Calle 10 y 20');
      expect(card.textContent).toContain('2 canchas');
      expect(card.querySelector('a')?.getAttribute('href')).toBe('/clubes/complex-real-1/turnos');
    });

    it('sin canchas muestra el complejo en la tarjeta destacada', () => {
      complexes$.next([complex]);
      complexes$.complete();
      matches$.next([]);
      matches$.complete();
      courts$.next([]);
      courts$.complete();
      fixture.detectChanges();

      const slides = fixture.nativeElement.querySelectorAll('.featured-court .slide');
      expect(slides).toHaveLength(1);
      expect(slides[0].textContent).toContain('Complejo Real');
    });
  });});
