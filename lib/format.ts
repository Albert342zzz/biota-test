/** Format angka untuk tampilan. Dipisah supaya UI dan CLI konsisten. */

const ID = 'id-ID';

/** "Rp1.234.567" — dibulatkan ke rupiah terdekat, tanpa desimal. */
export function formatIDR(value: number): string {
  return `Rp${Math.round(value).toLocaleString(ID)}`;
}

/** Versi pendek untuk tile dan label grafik: Rp1,2 jt / Rp1,23 M. */
export function formatIDRCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toLocaleString(ID, { maximumFractionDigits: 2 })} M`;
  if (abs >= 1_000_000) return `Rp${(value / 1_000_000).toLocaleString(ID, { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `Rp${(value / 1_000).toLocaleString(ID, { maximumFractionDigits: 0 })} rb`;
  return formatIDR(value);
}

export function formatNumber(value: number): string {
  return value.toLocaleString(ID);
}

/** "2026-10-01" -> "1 Okt 2026" */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  if (!y || !m || !d) return dateKey;
  return `${d} ${months[m - 1]} ${y}`;
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${((part / whole) * 100).toLocaleString(ID, { maximumFractionDigits: 1 })}%`;
}
