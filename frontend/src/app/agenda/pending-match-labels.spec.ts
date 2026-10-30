import { PendingMatch } from './agenda-api.service';
import { cancelOpenMatchNotice, missingLabel, playerNames, signedUpCountLabel, signedUpLabel } from './pending-match-labels';

const match = (missingPlayers: number, names: string[]): PendingMatch => ({
  id: 'm1',
  status: missingPlayers === 0 ? 'full' : 'open',
  targetLevel: '5ta',
  missingPlayers,
  players: names.map((name, index) => ({ name, level: '5ta', organizer: index === 0 })),
});

describe('HU-07: etiquetas de partidos pendientes', () => {
  it('cuenta los lugares que faltan en singular, plural y completo', () => {
    expect(missingLabel(match(3, ['Ana']))).toBe('Faltan 3');
    expect(missingLabel(match(2, ['Ana', 'Luis']))).toBe('Faltan 2');
    expect(missingLabel(match(1, ['Ana', 'Luis', 'Eva']))).toBe('Falta 1');
    expect(missingLabel(match(0, ['Ana', 'Luis', 'Eva', 'Dan']))).toBe('Completo');
  });

  it('resume los anotados', () => {
    expect(signedUpLabel(match(2, ['Ana', 'Luis']))).toBe('Anotados (2 de 4)');
    expect(signedUpCountLabel(match(3, ['Ana']))).toBe('1 jugador anotado');
    expect(signedUpCountLabel(match(1, ['Ana', 'Luis', 'Eva']))).toBe('3 jugadores anotados');
    expect(playerNames(match(2, ['Ana', 'Luis']))).toBe('Ana, Luis');
  });

  it('informa los anotados al cancelar y no promete avisos', () => {
    const notice = cancelOpenMatchNotice(match(1, ['Ana', 'Luis', 'Eva']));
    expect(notice).toBe('El partido tiene 3 jugadores anotados. Se cancelará y se liberará el turno; por ahora no se les avisa.');
    expect(notice).not.toContain('Se avisará');
    expect(cancelOpenMatchNotice(undefined)).toBe('El partido abierto se cancelará.');
  });
});
