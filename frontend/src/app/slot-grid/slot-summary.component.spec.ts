import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSessionService } from '../auth/auth-session.service';
import { AuthTokenStore } from '../auth/auth-token.store';
import { GridSlot } from './slot-grid.model';
import { SlotSummaryComponent } from './slot-summary.component';

const available: GridSlot = {
  id: 'c1:2026-11-02:20:00',
  courtId: 'c1',
  date: '2026-11-02',
  startsAt: '20:00',
  endsAt: '21:30',
  state: 'available',
  isPast: false,
};
const pending: GridSlot = {
  ...available,
  state: 'pending',
  pendingMatch: { missingPlayers: 2, level: '5ta' },
};

describe('HU-05: resumen del turno elegido', () => {
  let fixture: ComponentFixture<SlotSummaryComponent>;

  function render(slot: GridSlot, loggedIn: boolean): HTMLAnchorElement {
    TestBed.configureTestingModule({
      imports: [SlotSummaryComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    if (loggedIn) {
      TestBed.inject(AuthTokenStore).current.set('token');
      TestBed.inject(AuthSessionService).currentUser.set({
        id: 'u1',
        name: 'Ana Pérez',
        email: 'ana@example.com',
        zone: 'Gonnet',
        level: '5ta',
      });
    }
    fixture = TestBed.createComponent(SlotSummaryComponent);
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('courtName', 'Cancha 1');
    fixture.componentRef.setInput('dateLabel', 'Lunes, 2 de noviembre');
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('a.slot-summary__cta')!;
  }

  afterEach(() => fixture.destroy());

  it('sin sesión invita a ingresar para sumarse o reservar', () => {
    const cta = render(pending, false);
    expect(cta.getAttribute('href')).toBe('/ingresar');
    expect(cta.textContent).toContain('Ingresá para sumarte');
    fixture.destroy();
    TestBed.resetTestingModule();

    const free = render(available, false);
    expect(free.getAttribute('href')).toBe('/ingresar');
    expect(free.textContent).toContain('Ingresá para reservar');
  });

  it('con sesión lleva a los partidos abiertos si el turno es de partido abierto', () => {
    const cta = render(pending, true);
    expect(cta.getAttribute('href')).toBe('/partidos');
    expect(cta.textContent).toContain('Ver partidos abiertos');
    expect(fixture.nativeElement.textContent).toContain('Faltan 2 jugadores · nivel 5ta');
  });

  it('con sesión lleva a crear el partido si el turno está libre', () => {
    const cta = render(available, true);
    expect(cta.getAttribute('href')).toBe('/partidos?crear=1');
    expect(cta.textContent).toContain('Reservar este turno');
  });
});
