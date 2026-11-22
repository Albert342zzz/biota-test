'use client';

import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-5 sm:p-6"
      style={{ background: 'var(--surface-1)', boxShadow: '0 0 0 1px var(--ring)' }}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Tile angka: label, nilai, dan catatan opsional. Tanpa grafik. */
export function StatTile({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'muted' | 'critical';
}) {
  const color =
    tone === 'critical' ? 'var(--status-critical)' : tone === 'muted' ? 'var(--text-secondary)' : 'var(--text-primary)';
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--surface-1)', boxShadow: '0 0 0 1px var(--ring)' }}
    >
      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold" style={{ color }}>
        {value}
      </p>
      {note && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * Satu baris bar horizontal.
 *
 * Spesifikasi yang dipakai: tebal maksimal 24px, ujung data membulat 4px dan
 * kotak di garis dasar, track memakai step terang dari ramp yang sama.
 * Nilainya selalu dicetak sebagai teks di samping bar, jadi warna tidak pernah
 * jadi satu-satunya pembawa informasi.
 */
export function BarRow({
  label,
  sublabel,
  value,
  valueLabel,
  max,
  color,
  rank,
  title,
}: {
  label: string;
  sublabel?: string;
  value: number;
  valueLabel: string;
  max: number;
  color: string;
  rank?: number;
  title?: string;
}) {
  const pct = max > 0 ? Math.max(value / max, 0) * 100 : 0;
  return (
    <div className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-2" title={title}>
      <div className="flex min-w-0 items-baseline gap-2">
        {rank !== undefined && (
          <span className="tnum w-5 shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            {rank}
          </span>
        )}
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <span className="tnum text-sm font-semibold whitespace-nowrap">{valueLabel}</span>
      <div className="col-span-2 flex items-center gap-3">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-sm"
          style={{ background: 'var(--track)', opacity: 0.35 }}
        >
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: color,
              borderTopRightRadius: 4,
              borderBottomRightRadius: 4,
            }}
          />
        </div>
        {sublabel && (
          <span className="tnum shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
