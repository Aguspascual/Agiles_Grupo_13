import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthSessionService } from '../auth/auth-session.service';
import { MatchPreview } from './landing.data';
import { MatchDetailDialogComponent } from './match-detail-dialog.component';

// Partido con la organizadora en revés (lugar 2), una acompañante con nombre (lugar 1) y una jugadora sumada (lugar 3).
const MATCH: MatchPreview = {
  id: 'match-1', date: '2026-11-19', day: 'Jueves', time: '18:00 hs', duration: '90 min',
  club: 'Club de prueba', courtName: 'Cancha 1', image: '', imageAlt: '', address: 'Calle 1',
  zone: 'Gonnet', level: '5ta', price: '$4.500', openSpots: 1, guestPlayers: 1,
  guests: [{ name: 'Paula', slot: 1 }],
  players: [
    { initials: 'LF', name: 'Lucía Ferreyra', level: '5ta', tone: 'mint', position: 'Revés', organizer: true, slot: 2 },
    { initials: 'SB', name: 'Sofía Benítez', level: '5ta', tone: 'violet', position: 'Drive', slot: 3 },
  ],
  features: ['Techado'],
};

describe('HU-09: cancha del detalle del partido', () => {
  let fixture: ComponentFixture<MatchDetailDialogComponent>;

  async function render(match: MatchPreview): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [MatchDetailDialogComponent],
      providers: [{ provide: AuthSessionService, useValue: { currentUser: signal(null) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(MatchDetailDialogComponent);
    fixture.componentRef.setInput('match', match);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => fixture.destroy());

  it('no repite como "Acompañante" a la acompañante que ya tiene nombre y deja libre el lugar restante', async () => {
    const root = await render(MATCH);
    const names = [...root.querySelectorAll('.court-player')].map((tile) => tile.querySelector('b')?.textContent?.trim());

    expect(names).toEqual(['Paula', 'Lucía Ferreyra', 'Sofía Benítez', 'Tu lugar está acá']);
    expect(root.querySelectorAll('.court-player--empty')).toHaveLength(1);
    expect(root.textContent).not.toContain('Acompañante · sin cuenta Acompañante');
  });

  it('completa con "Acompañante" solo a los acompañantes sin nombre', async () => {
    const root = await render({ ...MATCH, guests: [], guestPlayers: 1 });
    const names = [...root.querySelectorAll('.court-player b')].map((name) => name.textContent?.trim());

    expect(names.filter((name) => name === 'Acompañante')).toHaveLength(1);
    expect(root.querySelectorAll('.court-player--empty')).toHaveLength(1);
  });

  it('ubica el drive a la derecha de cada pareja: abajo en la pareja A y arriba en la pareja B', async () => {
    const root = await render(MATCH);
    const tiles = [...root.querySelectorAll<HTMLElement>('.court-player')];
    const place = (index: number) => [tiles[index].style.gridColumn, tiles[index].style.gridRow];

    expect(place(0)).toEqual(['1', '2']); // Pareja A · Drive
    expect(place(1)).toEqual(['1', '1']); // Pareja A · Revés
    expect(place(2)).toEqual(['2', '1']); // Pareja B · Drive
    expect(place(3)).toEqual(['2', '2']); // Pareja B · Revés
  });
});
