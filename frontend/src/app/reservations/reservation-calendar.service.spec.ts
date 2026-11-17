import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComplexApiService } from '../complexes/complex-api.service';
import { PublicComplex } from '../complexes/complex.model';
import { CalendarDownloadService } from './calendar-download.service';
import { GoogleCalendarNavigationService } from './google-calendar-navigation.service';
import { ReservationCalendarService } from './reservation-calendar.service';
import { MyReservationItem } from './reservation-api.service';

const item: MyReservationItem = {
  kind: 'reservation', id: 'r1', reservationId: 'r1', status: 'reserved',
  complex: { id: 'c1', name: 'Club Árbol' }, court: { id: 'k1', name: 'Cancha 1' },
  startsAt: '2099-11-18T18:00:00-03:00', endsAt: '2099-11-18T19:30:00-03:00',
  timeZone: 'America/Argentina/Buenos_Aires', role: 'organizer', cancellable: true,
};

describe('ReservationCalendarService', () => {
  const listPublic = vi.fn();
  const save = vi.fn();
  const open = vi.fn();
  const exported = () => (save.mock.calls.at(-1)![0] as string).replace(/\r\n /g, '');
  let service: ReservationCalendarService;
  beforeEach(() => {
    listPublic.mockReset(); save.mockReset(); open.mockReset();
    TestBed.configureTestingModule({ providers: [ReservationCalendarService,
      { provide: ComplexApiService, useValue: { listPublic } },
      { provide: CalendarDownloadService, useValue: { save } },
      { provide: GoogleCalendarNavigationService, useValue: { open } },
    ] });
    service = TestBed.inject(ReservationCalendarService);
  });

  it('shares one lookup across cards and downloads using complex.id, not its name', () => {
    const response = new Subject<PublicComplex[]>();
    listPublic.mockReturnValue(response);
    service.download(item).subscribe();
    service.download({ ...item, reservationId: 'r2' }).subscribe();
    expect(listPublic).toHaveBeenCalledTimes(1);
    response.next([
      { id: 'other', name: 'Club Árbol', address: 'Incorrecta 1', zone: '' },
      { id: 'c1', name: 'Renombrado', address: 'Av. Córdoba 123', zone: '' },
    ]);
    response.complete();
    service.download(item).subscribe();
    expect(listPublic).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(3);
    expect(exported()).toContain('LOCATION:Club Árbol · Cancha 1 · Av. Córdoba 123');
    expect(exported()).not.toContain('Incorrecta');
    service.openGoogleCalendar(item).subscribe();
    expect(listPublic).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0]);
    expect(url.searchParams.get('location')).toBe('Club Árbol · Cancha 1 · Av. Córdoba 123');
    expect(url.searchParams.get('dates')).toBe('20991118T210000Z/20991118T223000Z');
    expect(save).toHaveBeenCalledTimes(3);
  });

  it.each(['missing', 'blank', 'error'])('downloads without an address on %s', (scenario) => {
    listPublic.mockReturnValue(scenario === 'error' ? throwError(() => new Error('offline')) : of(
      scenario === 'missing' ? [] : [{ id: 'c1', name: 'Club', address: '  ', zone: '' }],
    ));
    service.download(item).subscribe();
    service.download(item).subscribe();
    expect(listPublic).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(exported()).toContain('LOCATION:Club Árbol · Cancha 1\r\n');
    service.openGoogleCalendar(item).subscribe();
    expect(listPublic).toHaveBeenCalledTimes(1);
    expect(new URL(open.mock.calls[0][0]).searchParams.get('location')).toBe('Club Árbol · Cancha 1');
  });

  it('falls back when the address request times out', () => {
    vi.useFakeTimers();
    try {
      listPublic.mockReturnValue(new Subject<PublicComplex[]>());
      service.download(item).subscribe();
      service.openGoogleCalendar(item).subscribe();
      vi.advanceTimersByTime(5000);
      expect(save).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledTimes(1);
      expect(listPublic).toHaveBeenCalledTimes(1);
      expect(exported()).toContain('LOCATION:Club Árbol · Cancha 1\r\n');
    } finally { vi.useRealTimers(); }
  });

  it('reports invalid times without starting a download', () => {
    listPublic.mockReturnValue(of([]));
    const error = vi.fn();
    service.download({ ...item, endsAt: 'invalid' }).subscribe({ error });
    expect(error).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    service.openGoogleCalendar({ ...item, endsAt: 'invalid' }).subscribe({ error });
    expect(error).toHaveBeenCalledTimes(2);
    expect(open).not.toHaveBeenCalled();
    expect(listPublic).not.toHaveBeenCalled();
  });
});
