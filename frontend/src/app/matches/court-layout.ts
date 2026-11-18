/**
 * Fila que ocupa cada lugar en la cancha vista desde arriba, con la red en el medio.
 * Cada pareja mira hacia la red, así que su drive queda a su derecha: abajo para la pareja A
 * (lado izquierdo) y arriba para la pareja B (lado derecho). El revés queda en la otra fila.
 */
export function courtRow(pair: 'A' | 'B', side: 'Drive' | 'Revés'): 1 | 2 {
  const driveRow = pair === 'A' ? 2 : 1;
  return side === 'Drive' ? driveRow : driveRow === 1 ? 2 : 1;
}
