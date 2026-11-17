import { Agenda, AgendaReservation } from './agenda-api.service';

const HEADERS = ['Fecha', 'Cancha', 'Hora de inicio', 'Hora de fin', 'Origen', 'Estado'];

export function agendaMatchesSelection(agenda: Agenda | null, complexId: string, date: string): boolean {
  return agenda?.complex.id === complexId && agenda.date === date;
}

/** Crea CSV separado por punto y coma para facilitar su apertura en planillas locales. */
export function buildAgendaCsv(agenda: Agenda): string {
  const rows = agenda.courts.flatMap((court) =>
    court.reservations.map((reservation) => [
      agenda.date,
      court.name,
      reservation.startsAt,
      reservation.endsAt,
      originLabel(reservation),
      'Reservado',
    ]),
  );
  return `\uFEFF${[HEADERS, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n')}\r\n`;
}

export function downloadAgendaCsv(agenda: Agenda): void {
  const blob = new Blob([buildAgendaCsv(agenda)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agenda-${agenda.date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function originLabel(reservation: AgendaReservation): string {
  if (reservation.origin === 'web') return 'Web';
  return reservation.origin === 'open_match' ? 'Partido abierto' : 'Manual';
}

function escapeCell(value: string): string {
  const safeValue = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
