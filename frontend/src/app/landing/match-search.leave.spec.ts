import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { MatchApiService } from '../matches/match-api.service';
import { MatchPreview } from './landing.data';
import { MatchSearchPage } from './match-search.page';

describe('HU-13: baja desde el detalle del partido', () => {
  it('cierra el modal y confirma la baja cuando responde la API', async () => {
    const user = { id: 'player-1', name: 'Agustin Pascual', email: 'agus@example.com', zone: 'Gonnet', level: '5ta' };
    const match: MatchPreview = {
      id: 'match-1', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      day: 'Mañana', time: '23:00 hs', duration: '60 min', club: 'Club de prueba', courtName: 'Cancha 1',
      image: '', imageAlt: '', address: 'Calle de prueba', zone: 'Gonnet', level: '5ta', price: '', openSpots: 3,
      players: [{ initials: 'AP', name: user.name, level: '5ta', tone: 'mint', organizer: true }],
      features: ['Techado'],
    };
    const leaveResponse = new Subject<{ deleted: boolean }>();
    const api = {
      list: vi.fn().mockReturnValueOnce(of([match])).mockReturnValueOnce(of([])),
      leave: vi.fn(() => leaveResponse.asObservable()),
    } as unknown as MatchApiService;
    const session = { restore: vi.fn(() => of(user)), currentUser: vi.fn(() => user) };

    await TestBed.configureTestingModule({
      imports: [MatchSearchPage],
      providers: [
        provideRouter([]),
        { provide: MatchApiService, useValue: api },
        { provide: AuthSessionService, useValue: session },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MatchSearchPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[data-match-detail]')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('.leave-match-button')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('.leave-confirm-submit')?.click();
    await fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('.leave-match-button')?.textContent).toContain('Procesando');
    leaveResponse.next({ deleted: true });
    leaveResponse.complete();
    await fixture.whenStable();

    expect(root.querySelector('.match-detail-dialog')).toBeNull();
    expect(root.querySelector('app-toast')?.textContent).toContain('El partido se eliminó y el turno quedó libre');
    fixture.destroy();
  });
});
