// Formatadores compartilhados de moeda e número (pt-BR).
export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const NUM = new Intl.NumberFormat('pt-BR');

/**
 * Rótulo curto de período:
 *  yyyy-MM-dd → dd/MM
 *  yyyy-MM    → MM/yy
 *  yyyy       → yyyy
 */
export function formatPeriodLabel(period: string): string {
  const parts = period.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (parts.length === 2) return `${parts[1]}/${parts[0].slice(2)}`;
  return period;
}
