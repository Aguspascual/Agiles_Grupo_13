import { Agenda } from './agenda-api.service';
import { agendaMatchesSelection, buildAgendaCsv } from './agenda-csv';

const agenda: Agenda = {
  complex: { id: 'c1', name: 'Complejo privado', address: 'Dirección privada', zone: 'Zona' },
  date: '2026-11-18',
  courts: [
    {
      id: 'k1',
      name: 'Cancha "Norte";\n=1+1',
      covered: false,
      slots: [],
      reservations: [
        {
          id: 'reserva-privada',
          origin: 'web',
          startsAt: '18:00',
          endsAt: '19:30',
          originalStartsAt: '',
          originalEndsAt: '',
          contact: { name: 'Nombre privado', phone: '221-555' },
          cancellable: true,
        },
      ],
    },
    {
      id: 'k2',
      name: 'Cancha Sur',
      covered: false,
      slots: [],
      reservations: [
        {
          id: 'r2',
          origin: 'open_match',
          startsAt: '20:00',
          endsAt: '21:30',
          originalStartsAt: '',
          originalEndsAt: '',
          contact: { name: 'Otro nombre privado', phone: '222-000' },
          cancellable: true,
        },
      ],
    },
  ],
};

describe('HU-25: exportación CSV de agenda', () => {
  it('solo considera exportable la agenda del complejo y día seleccionados', () => {
    expect(agendaMatchesSelection(agenda, 'c1', '2026-11-18')).toBe(true);
    expect(agendaMatchesSelection(agenda, 'c1', '2026-11-19')).toBe(false);
    expect(agendaMatchesSelection(agenda, 'c2', '2026-11-18')).toBe(false);
    expect(agendaMatchesSelection(null, 'c1', '2026-11-18')).toBe(false);
  });

  it('exporta fecha, cancha, horarios, origen y estado con una fila por reserva', () => {
    const csv = buildAgendaCsv(agenda);
    expect(csv).toContain('\uFEFF"Fecha";"Cancha";"Hora de inicio";"Hora de fin";"Origen";"Estado"');
    expect(csv).toContain('"2026-11-18";"Cancha ""Norte"";');
    expect(csv).toContain('"18:00";"19:30";"Web";"Reservado"');
    expect(csv).toContain('"20:00";"21:30";"Partido abierto";"Reservado"');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3);
  });

  it('escapa comillas, separadores y saltos, protege fórmulas y excluye datos personales', () => {
    const csv = buildAgendaCsv(agenda);
    expect(csv).toContain(`"Cancha ""Norte"";\n=1+1"`);
    expect(csv).not.toContain('Nombre privado');
    expect(csv).not.toContain('221-555');
    expect(csv).not.toContain('reserva-privada');
    expect(csv).not.toContain('Complejo privado');
  });

  it('protege texto que comienza con signo de fórmula, incluso tras espacios', () => {
    const malicious = { ...agenda, courts: [{ ...agenda.courts[0], name: '  @SUM(A1)' }] };
    expect(buildAgendaCsv(malicious)).toContain('"\'  @SUM(A1)"');
  });
});
