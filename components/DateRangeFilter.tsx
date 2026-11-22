'use client';

/**
 * Filter rentang tanggal. Kedua ujung INKLUSIF.
 *
 * Nilai disimpan sebagai string "YYYY-MM-DD" — bentuk yang sama dengan
 * `dateKey` di data — jadi perbandingannya tidak pernah lewat objek Date dan
 * tidak bisa bergeser karena timezone.
 */
export interface Preset {
  label: string;
  from: string;
  to: string;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Preset paruh bulan.
 *
 * Bulan acuannya diambil dari tanggal TERAKHIR, bukan tanggal pertama. Ekspor
 * bulanan sering memuat beberapa baris nyasar dari bulan sebelumnya; kalau
 * acuannya tanggal pertama, satu baris nyasar saja sudah membuat preset
 * menunjuk ke bulan yang salah — "Tanggal 1–15" jadi menampilkan nol baris
 * padahal datanya ada.
 *
 * Label menyebut nama bulannya supaya tidak ambigu saat file memuat lebih dari
 * satu bulan, dan rentangnya dipotong agar tidak melewati data yang ada.
 */
export function buildPresets(min: string, max: string): Preset[] {
  const month = max.slice(0, 7);
  const [year, monthNo] = month.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const name = MONTH_SHORT[monthNo - 1] ?? month;

  // Jangan pernah keluar dari rentang data yang benar-benar ada.
  const clamp = (d: string) => (d < min ? min : d > max ? max : d);
  const pad = (n: number) => String(n).padStart(2, '0');

  const presets: Preset[] = [{ label: 'Seluruh periode', from: min, to: max }];

  const firstHalf = { from: `${month}-01`, to: `${month}-15` };
  const secondHalf = { from: `${month}-16`, to: `${month}-${pad(lastDayOfMonth)}` };

  // Tampilkan sebuah preset hanya kalau rentangnya benar-benar beririsan
  // dengan data — tombol yang pasti menghasilkan dashboard kosong lebih
  // membingungkan daripada tidak ada tombol sama sekali.
  if (firstHalf.from <= max && firstHalf.to >= min) {
    presets.push({ label: `1–15 ${name}`, from: clamp(firstHalf.from), to: clamp(firstHalf.to) });
  }
  if (secondHalf.from <= max && secondHalf.to >= min) {
    presets.push({
      label: `16–${lastDayOfMonth} ${name}`,
      from: clamp(secondHalf.from),
      to: clamp(secondHalf.to),
    });
  }
  return presets;
}

export function DateRangeFilter({
  min,
  max,
  from,
  to,
  onChange,
}: {
  min: string;
  max: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const presets = buildPresets(min, max);
  const invalid = from > to;

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.from, p.to)}
              aria-pressed={active}
              className="btn chip px-3 py-1.5 text-sm"
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Dari
          <input
            type="date"
            value={from}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value, to)}
            className="mt-1 block rounded-md px-2 py-1.5 text-sm"
            style={{ background: 'var(--surface-1)', boxShadow: '0 0 0 1px var(--baseline)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Sampai
          <input
            type="date"
            value={to}
            min={min}
            max={max}
            onChange={(e) => onChange(from, e.target.value)}
            className="mt-1 block rounded-md px-2 py-1.5 text-sm"
            style={{ background: 'var(--surface-1)', boxShadow: '0 0 0 1px var(--baseline)', color: 'var(--text-primary)' }}
          />
        </label>
      </div>

      {invalid && (
        <p className="text-xs font-medium" style={{ color: 'var(--status-critical)' }}>
          Tanggal mulai melewati tanggal akhir — tidak ada data yang cocok.
        </p>
      )}
    </div>
  );
}
