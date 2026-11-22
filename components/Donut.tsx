'use client';

import { useId, useState } from 'react';

/**
 * Donut part-to-whole.
 *
 * Aturan yang dipakai (dan alasannya):
 *  - Maksimal 6 irisan. Lebih dari itu, warnanya mulai tidak bisa dibedakan dan
 *    membandingkan sudut jadi lebih sulit daripada membaca angka. Sisanya
 *    dilipat jadi satu irisan "Lainnya" oleh pemanggilnya.
 *  - Antar irisan diberi jarak 2px berwarna latar, bukan garis tepi. Jarak itu
 *    yang memisahkan, bukan stroke tambahan.
 *  - Legend selalu ada dan memuat nama + angka, jadi warna tidak pernah menjadi
 *    satu-satunya pembawa identitas.
 *  - Teks memakai token teks, tidak pernah memakai warna seri.
 *  - Tiap irisan bisa di-hover dan di-fokus lewat keyboard; angkanya muncul di
 *    tengah donut, sehingga tidak perlu menempelkan angka di tiap irisan.
 */

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Baris keterangan kecil di legend, mis. jumlah unit. */
  note?: string;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const R_OUTER = 92;
const R_INNER = 58;
/** Jarak antar irisan, dalam satuan viewBox (setara ~2px pada ukuran render). */
const GAP = 2;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(R_OUTER, startDeg);
  const [x2, y2] = polar(R_OUTER, endDeg);
  const [x3, y3] = polar(R_INNER, endDeg);
  const [x4, y4] = polar(R_INNER, startDeg);
  return [
    `M ${x1} ${y1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export function Donut({
  slices,
  totalLabel,
  formatValue,
  formatCenter,
}: {
  slices: DonutSlice[];
  /** Keterangan di tengah donut saat tidak ada irisan yang di-hover. */
  totalLabel: string;
  /** Format angka untuk legend. */
  formatValue: (n: number) => string;
  /** Format angka untuk bagian tengah (biasanya versi ringkas). */
  formatCenter: (n: number) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const titleId = useId();

  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        Tidak ada nilai untuk ditampilkan.
      </p>
    );
  }

  // Jarak antar irisan dinyatakan dalam derajat pada lingkar luar.
  const gapDeg = (GAP / (2 * Math.PI * R_OUTER)) * 360;
  const single = visible.length === 1;

  let cursor = 0;
  const arcs = visible.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const start = cursor;
    cursor += sweep;
    // Irisan yang sangat tipis tidak boleh habis termakan jarak.
    const inset = Math.min(gapDeg / 2, sweep / 4);
    return { slice, start: start + inset, end: start + sweep - inset, share: slice.value / total };
  });

  const hovered = arcs.find((a) => a.slice.key === active);
  const centerTop = hovered ? hovered.slice.label : totalLabel;
  const centerValue = hovered ? hovered.slice.value : total;
  const centerShare = hovered ? `${(hovered.share * 100).toFixed(1).replace('.', ',')}%` : '100%';

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
        className="h-44 w-44 shrink-0 sm:h-48 sm:w-48"
        onMouseLeave={() => setActive(null)}
      >
        <title id={titleId}>
          {visible
            .map((s) => `${s.label}: ${formatValue(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`)
            .join('. ')}
        </title>

        {single ? (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={(R_OUTER + R_INNER) / 2}
            fill="none"
            stroke={visible[0].color}
            strokeWidth={R_OUTER - R_INNER}
          />
        ) : (
          arcs.map(({ slice, start, end }) => {
            const dim = active !== null && active !== slice.key;
            return (
              <path
                key={slice.key}
                d={arcPath(start, end)}
                fill={slice.color}
                opacity={dim ? 0.35 : 1}
                style={{ transition: 'opacity .15s', cursor: 'pointer', outline: 'none' }}
                tabIndex={0}
                role="button"
                aria-label={`${slice.label}: ${formatValue(slice.value)}, ${((slice.value / total) * 100).toFixed(1)} persen`}
                onMouseEnter={() => setActive(slice.key)}
                onFocus={() => setActive(slice.key)}
                onBlur={() => setActive(null)}
              />
            );
          })
        )}

        {/* Angka di tengah: berubah mengikuti irisan yang disentuh, sehingga
            tidak perlu menempelkan angka pada setiap irisan. */}
        <text
          x={CENTER}
          y={CENTER - 12}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          style={{ pointerEvents: 'none' }}
        >
          {centerTop.length > 18 ? `${centerTop.slice(0, 17)}…` : centerTop}
        </text>
        <text
          x={CENTER}
          y={CENTER + 8}
          textAnchor="middle"
          fontSize="19"
          fontWeight="600"
          fill="var(--text-primary)"
          style={{ pointerEvents: 'none' }}
        >
          {formatCenter(centerValue)}
        </text>
        <text
          x={CENTER}
          y={CENTER + 26}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-muted)"
          style={{ pointerEvents: 'none' }}
        >
          {centerShare}
        </text>
      </svg>

      {/* Legend: identitas dibawa nama + swatch, bukan warna saja. */}
      <ul className="min-w-0 flex-1 space-y-1">
        {arcs.map(({ slice, share }) => (
          <li key={slice.key}>
            <button
              type="button"
              className="legend-row"
              onMouseEnter={() => setActive(slice.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(slice.key)}
              onBlur={() => setActive(null)}
              aria-label={`${slice.label}: ${formatValue(slice.value)}`}
            >
              <span
                aria-hidden
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{slice.label}</span>
                {slice.note && (
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {slice.note}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block text-sm font-semibold">{formatValue(slice.value)}</span>
                <span className="tnum block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {(share * 100).toFixed(1).replace('.', ',')}%
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
