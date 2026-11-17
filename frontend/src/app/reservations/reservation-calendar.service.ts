import { Injectable, inject } from '@angular/core';
import { catchError, defer, map, Observable, of, shareReplay, timeout } from 'rxjs';
import { ComplexApiService } from '../complexes/complex-api.service';
import { CalendarDownloadService } from './calendar-download.service';
import { MyReservationItem } from './reservation-api.service';
import { createGoogleCalendarUrl, createReservationCalendar } from './reservation-calendar';
import { GoogleCalendarNavigationService } from './google-calendar-navigation.service';

/** Page-scoped lookup: one request shared by every card, including failed lookups. */
@Injectable()
export class ReservationCalendarService {
  private readonly complexes = inject(ComplexApiService);
  private readonly downloader = inject(CalendarDownloadService);
  private readonly navigation = inject(GoogleCalendarNavigationService);
  private readonly addresses = defer(() => this.complexes.listPublic()).pipe(
    timeout(5000),
    map(complexes => new Map(complexes.map(complex => [complex.id, complex.address]))),
    catchError(() => of(new Map<string, string>())),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  openGoogleCalendar(item: MyReservationItem): Observable<void> {
    return defer(() => {
      createGoogleCalendarUrl(item);
      return this.addresses.pipe(map(addresses => {
        this.navigation.open(createGoogleCalendarUrl(item, addresses.get(item.complex.id)));
      }));
    });
  }

  download(item: MyReservationItem): Observable<void> {
    return defer(() => {
      // Validate before waiting for an optional address or allocating a download.
      createReservationCalendar(item);
      return this.addresses.pipe(map(addresses => {
        this.downloader.save(
          createReservationCalendar(item, addresses.get(item.complex.id)),
          `reserva-${encodeURIComponent(item.reservationId)}.ics`,
        );
      }));
    });
  }
}
