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

export function buildPresets(min: string, max: string): Preset[] {
  const month = min.slice(0, 7);
  const lastDay = max.slice(8, 10);
  return [
    { label: 'Seluruh periode', from: min, to: max },
    { label: 'Tanggal 1–15', from: `${month}-01`, to: `${month}-15` },
    { label: `Tanggal 16–${lastDay}`, from: `${month}-16`, to: max },
  ];
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
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={
                active
                  ? { background: 'var(--series-1)', color: '#fff' }
                  : { boxShadow: '0 0 0 1px var(--baseline)', color: 'var(--text-secondary)' }
              }
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
