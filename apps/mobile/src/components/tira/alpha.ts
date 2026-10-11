/**
 * Helper alpha — converte hex de tokens (#RRGGBB) em rgba(r,g,b,a).
 * Usado para réplicas das classes web /10 /20 /30 /40 /50 /60.
 */
export function alpha(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
