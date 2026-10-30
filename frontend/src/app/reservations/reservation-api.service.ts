import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { parseReceipt, ReservationReceipt } from '../agenda/agenda-api.service';

/**
 * Cancelación de una reserva propia (HU-14, TDD-0010): `POST /api/v1/reservations/{id}/cancel`.
 * La consumirá la pantalla "Mis reservas" de HU-17; por ahora no hay pantalla que la use.
 * Errores: 404 si no es la reserva del jugador, 409 si faltan menos de 4 horas.
 */
@Injectable({ providedIn: 'root' })
export class ReservationApiService {
  private readonly http = inject(HttpClient);

  cancelOwn(reservationId: string): Observable<ReservationReceipt> {
    return this.http
      .post<unknown>(`/api/v1/reservations/${encodeURIComponent(reservationId)}/cancel`, null)
      .pipe(map(parseReceipt));
  }
}
