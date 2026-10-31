import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthSessionService } from '../auth/auth-session.service';
import { MatchPreview } from './landing.data';
import { MatchDetailDialogComponent } from './match-detail-dialog.component';

const MATCH: MatchPreview = {
  id: 'match-1', date: '2026-11-01', day: 'Domingo', time: '10:00 hs', duration: '90 min',
  club: 'Club de prueba', courtName: 'Cancha 1', image: '', imageAlt: '', address: 'Calle 1',
  zone: 'Gonnet', level: '5ta', price: '$4.500', openSpots: 2,
  players: [{ initials: 'LM', name: 'Lucas Marchetti', level: '5ta', tone: 'mint' }], features: ['Techado'],
};

describe('HU-11: persistencia visual de la inscripción', () => {
  let fixture: ComponentFixture<MatchDetailDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchDetailDialogComponent],
      providers: [{
        provide: AuthSessionService,
        useValue: { currentUser: signal({ id: 'user-1', name: '  lucas marchetti ', email: '', zone: '', level: '5ta' }) },
      }],
    }).compileComponents();
    fixture = TestBed.createComponent(MatchDetailDialogComponent);
    fixture.componentRef.setInput('match', MATCH);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('reconoce a la cuenta entre los jugadores y no ofrece volver a inscribirse', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Tu lugar en este partido est\u00e1 confirmado');
    expect(root.querySelector('.join-match-button')).toBeNull();
  });
});
