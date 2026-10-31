import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { CreateMatchDialogComponent } from './create-match-dialog.component';
import { FullMatchApiService } from './full-match-api.service';
import { MatchApiService } from './match-api.service';

const COMPLEXES = [
  { id: 'c1', name: 'Club Norte', address: 'Calle 1', zone: 'Gonnet', courts: [{ id: 'k1', name: 'Cancha 1', covered: true, lighting: true }, { id: 'k2', name: 'Cancha 2', covered: false, lighting: false }] },
];
const slotDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const SLOTS = new Map([['k1', [
  { id: 's1', startsAt: '18:00', endsAt: '19:00', status: 'AVAILABLE' as const, isPast: false },
  { id: 's2', startsAt: '19:00', endsAt: '20:00', status: 'AVAILABLE' as const, isPast: false },
]]]);

describe('modal de crear nuevo partido', () => {
  const createOpen = vi.fn(() => of({}));
  const searchPlayers = vi.fn();
  const user = { id: 'me', name: 'Ana Pérez', email: 'ana@example.com', zone: 'Gonnet', level: '5ta', position: 'Revés' };

  async function render() {
    createOpen.mockClear();
    await TestBed.configureTestingModule({
      imports: [CreateMatchDialogComponent],
      providers: [
        provideRouter([]),
        { provide: MatchApiService, useValue: { complexes: vi.fn(() => of(COMPLEXES)), availability: vi.fn(() => of(SLOTS)), createOpen } },
        { provide: FullMatchApiService, useValue: { searchPlayers } },
        { provide: AuthSessionService, useValue: { currentUser: () => user } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CreateMatchDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement;
  const open = (fixture: Awaited<ReturnType<typeof render>>, host: string, label: string) => {
    (root(fixture).querySelector(`${host} .select-trigger, ${host} .multi-trigger`) as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = [...root(fixture).querySelectorAll(`${host} [role="option"]`)] as HTMLElement[];
    return items.find((item) => item.textContent?.includes(label));
  };

  it('no muestra "PádelMatch · La Plata" en el encabezado', async () => {
    const fixture = await render();
    expect(root(fixture).querySelector('.create-match-dialog__header')?.textContent).not.toContain('LA PLATA');
    expect(root(fixture).querySelector('.eyebrow')).toBeNull();
  });

  it('complejo, cancha y horario usan los selectores del sistema', async () => {
    const fixture = await render();
    expect(root(fixture).querySelectorAll('.form-grid select')).toHaveLength(0);
    expect(root(fixture).querySelectorAll('.form-grid app-select-menu')).toHaveLength(3);

    (open(fixture, '.form-grid .field:nth-of-type(2)', 'Cancha 2') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.courtId).toBe('k2');
  });

  it('el nivel buscado admite hasta tres niveles', async () => {
    const fixture = await render();
    const host = '.form-grid app-multi-select';
    (open(fixture, host, '6ta') as HTMLElement).click();
    fixture.detectChanges();
    (root(fixture).querySelectorAll(`${host} [role="option"]`)[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.targetLevels).toHaveLength(3);

    const blocked = [...root(fixture).querySelectorAll(`${host} [role="option"]`)].find((item) => item.textContent?.includes('1ra')) as HTMLElement;
    blocked.click();
    expect(fixture.componentInstance.targetLevels).toHaveLength(3);
  });

  it('en un partido abierto se elige el lugar en la cancha y se envía con los niveles', async () => {
    const fixture = await render();
    expect(root(fixture).querySelector('app-court-position-picker')).not.toBeNull();
    expect(fixture.componentInstance.slot).toBe(2);

    (root(fixture).querySelectorAll('.court-picker__spot')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.slot).toBe(3);
    (open(fixture, '.form-grid app-multi-select', '6ta') as HTMLElement).click();
    fixture.componentInstance.startsAt = '18:00';
    fixture.componentInstance.submit();

    expect(createOpen).toHaveBeenCalledWith('c1', 'k1', expect.objectContaining({ targetLevel: '5ta', targetLevels: ['5ta', '6ta'], slot: 3 }));
  });

  it('no ofrece como invitado al organizador ni a quien ya está cargado en otro lugar', async () => {
    const fixture = await render();
    fixture.componentInstance.updateInvitee(0, { query: 'Beto Díaz', selected: { id: 'beto', name: 'Beto Díaz', emailHint: 'b***@example.com' } });

    expect(fixture.componentInstance.excludedFor(1)).toEqual(['beto', 'me']);
    expect(fixture.componentInstance.excludedFor(0)).toEqual(['me']);
  });
});