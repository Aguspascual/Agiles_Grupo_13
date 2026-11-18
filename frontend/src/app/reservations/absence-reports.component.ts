import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, inject, signal } from '@angular/core';
import { AbsenceState, ReservationApiService } from './reservation-api.service';

@Component({
  selector: 'app-absence-reports', standalone: true,
  styleUrl: './absence-reports.component.scss',
  template: `
    <section class="absence" aria-label="Reportes de ausencia">
      <button type="button" class="absence__toggle" (click)="toggle()" [attr.aria-expanded]="opened()">{{ opened() ? 'Ocultar ausencias' : 'Consultar ausencias' }}</button>
      @if (opened()) {
        @if (loading()) { <p role="status">Consultando participantes…</p> }
        @else if (error()) { <p role="alert">{{ error() }} <button type="button" (click)="load()">Reintentar</button></p> }
        @else if (state(); as data) {
          <p class="absence__window" role="status">{{ data.windowOpen ? 'Plazo vigente hasta ' + deadline(data.deadline) : 'Plazo vencido el ' + deadline(data.deadline) }}. Podés consultar el estado.</p>
          <ul>
            @for (player of data.players; track player.id) {
              <li><span>{{ player.name }}{{ player.isSelf ? ' (vos)' : '' }}</span>
                <span>{{ Math.min(player.reportCount, 2) }}/2 · {{ player.confirmed ? 'Ausencia confirmada' : 'Pendiente' }}</span>
                @if (player.reportedByMe) { <span>Ya reportaste</span> }
                @if (player.canReport) { <button type="button" [disabled]="saving()" (click)="target.set(player.id)">Reportar ausencia</button> }
              </li>
            }
          </ul>
        }
      }
      @if (target()) { <div class="absence__confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar ausencia"><p>¿Confirmás que este jugador estuvo ausente?</p><button type="button" [disabled]="saving()" (click)="target.set(null)">Volver</button><button type="button" [disabled]="saving()" (click)="confirm()">{{ saving() ? 'Enviando…' : 'Confirmar reporte' }}</button></div> }
    </section>`
})
export class AbsenceReportsComponent {
  readonly matchId = input.required<string>();
  private readonly api = inject(ReservationApiService);
  readonly Math = Math;
  readonly opened = signal(false); readonly loading = signal(false); readonly saving = signal(false);
  readonly error = signal(''); readonly state = signal<AbsenceState | null>(null); readonly target = signal<string | null>(null);
  toggle(): void { this.opened.update(value => !value); if (this.opened() && !this.state()) this.load(); }
  load(): void { if (this.loading()) return; this.loading.set(true); this.error.set(''); this.api.getAbsences(this.matchId()).subscribe({
    next: state => { this.state.set(state); this.loading.set(false); }, error: err => { this.loading.set(false); this.error.set(err instanceof HttpErrorResponse && err.status === 403 ? 'Solo quienes participaron pueden consultar este partido.' : 'No pudimos consultar las ausencias. Revisá tu conexión.'); }
  }); }
  confirm(): void { const playerId = this.target(); if (!playerId || this.saving() || !this.state()?.players.some(p => p.id === playerId && p.canReport)) return;
    this.saving.set(true); this.error.set(''); this.api.reportAbsence(this.matchId(), playerId).subscribe({
      next: state => { this.state.set(state); this.target.set(null); this.saving.set(false); }, error: err => { this.saving.set(false); this.target.set(null);
        if (err instanceof HttpErrorResponse && err.status === 409) this.error.set('El plazo venció o ya reportaste a esta persona. Actualizamos el estado.');
        else if (err instanceof HttpErrorResponse && err.status === 403) this.error.set('El servidor no reconoce tu participación en este partido.');
        else this.error.set('No pudimos registrar el reporte. Intentá nuevamente.'); this.load(); }
    });
  }
  deadline(value: string): string { return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)); }
}
