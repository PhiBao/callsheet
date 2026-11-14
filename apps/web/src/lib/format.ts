export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function formatSigned(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}$${(abs / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = months[Number(m) - 1];
  if (!month) return iso;
  return `${month} ${Number(d)}, ${y}`;
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  if (!m || !d) return iso;
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

export function sum(lines: { patient_cents: number }[]): number {
  return lines.reduce((a, l) => a + l.patient_cents, 0);
}

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}
