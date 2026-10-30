import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReservationApiService {
  private readonly http = inject(HttpClient);

  reserveGroup(
    complexId: string,
    courtId: string,
    request: { date: string; startsAt: string; contact: { name: string; phone: string } },
  ): Observable<void> {
    const url = `/api/v1/complexes/${encodeURIComponent(complexId)}/courts/${encodeURIComponent(courtId)}/reservations`;
    return this.http.post<unknown>(url, request).pipe(map(() => undefined));
  }
}
