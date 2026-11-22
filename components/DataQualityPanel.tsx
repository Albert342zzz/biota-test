'use client';

import { useState } from 'react';
import { formatIDR, formatNumber } from '@/lib/format';
import type { CleanResult, Issue, IssueCode } from '@/lib/types';

/** Penjelasan tiap masalah dalam bahasa yang bisa dibaca orang non-teknis. */
const LABELS: Record<IssueCode, { title: string; effect: string; severity: 'info' | 'warn' | 'bad' }> = {
  sku_recovered_from_name: {
    title: 'Kode produk kosong, dipulihkan dari nama listing',
    effect: 'Baris ini tetap dihitung.',
    severity: 'info',
  },
  duplicate_row: {
    title: 'Baris kembar persis',
    effect: 'Dihitung sekali saja, tidak dobel.',
    severity: 'info',
  },
  total_mismatch: {
    title: 'Total baris tidak sama dengan jumlah x harga',
    effect: 'Dipakai hasil jumlah x harga.',
    severity: 'warn',
  },
  unknown_status: {
    title: 'Status pesanan tidak dikenali',
    effect: 'TIDAK dihitung sebagai net revenue. Perlu dicek manual.',
    severity: 'bad',
  },
  unknown_channel: {
    title: 'Nama channel tidak dikenali',
    effect: 'Dihitung, tapi masuk kelompok "Unknown".',
    severity: 'warn',
  },
  missing_sku: {
    title: 'Kode produk kosong dan tidak bisa dipulihkan',
    effect: 'Baris tidak dihitung.',
    severity: 'bad',
  },
  unparsable_date: {
    title: 'Tanggal pesanan tidak bisa dibaca',
    effect: 'Baris tidak dihitung.',
    severity: 'bad',
  },
  invalid_qty: {
    title: 'Jumlah unit tidak valid',
    effect: 'Baris tidak dihitung.',
    severity: 'bad',
  },
  unparsable_price: {
    title: 'Harga tidak bisa dibaca',
    effect: 'Baris tidak dihitung.',
    severity: 'bad',
  },
  missing_order_id: {
    title: 'Nomor pesanan kosong',
    effect: 'Dihitung, tapi jumlah pesanan unik jadi kurang akurat.',
    severity: 'warn',
  },
  mixed_status_in_order: {
    title: 'Satu pesanan punya status berbeda antar baris',
    effect: 'Status dihitung per baris (retur sebagian).',
    severity: 'warn',
  },
  date_outside_dominant_month: {
    title: 'Tanggal di luar bulan utama file',
    effect: 'Tetap dihitung. Pakai filter tanggal kalau tidak diinginkan.',
    severity: 'warn',
  },
};

const TONE = {
  info: 'var(--text-secondary)',
  warn: 'var(--status-warning)',
  bad: 'var(--status-critical)',
} as const;

export function DataQualityPanel({ result }: { result: CleanResult }) {
  const [open, setOpen] = useState<IssueCode | null>(null);
  const { issues, stats } = result;

  const grouped = new Map<IssueCode, Issue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.code);
    if (list) list.push(issue);
    else grouped.set(issue.code, [issue]);
  }
  const order = [...grouped.entries()].sort((a, b) => {
    const rank = { bad: 0, warn: 1, info: 2 } as const;
    return rank[LABELS[a[0]].severity] - rank[LABELS[b[0]].severity] || b[1].length - a[1].length;
  });

  return (
    <div>
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {[
          ['Baris di file', formatNumber(stats.rawRows)],
          ['Baris kembar dibuang', formatNumber(stats.duplicateRows)],
          ['Baris tidak terpakai', formatNumber(stats.droppedRows)],
          ['Baris dipakai menghitung', formatNumber(stats.keptRows)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {k}
            </dt>
            <dd className="tnum font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {stats.missingHeaders.length > 0 && (
        <p
          className="mb-4 rounded-md p-3 text-sm"
          style={{ background: 'var(--surface-2)', color: 'var(--status-critical)' }}
        >
          Kolom wajib tidak ditemukan: <strong>{stats.missingHeaders.join(', ')}</strong>. Angka di
          bawah hampir pasti tidak benar.
        </p>
      )}
      {stats.unmappedHeaders.length > 0 && (
        <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Kolom yang tidak dipakai: {stats.unmappedHeaders.join(', ')}
        </p>
      )}

      {order.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tidak ada masalah data yang ditemukan.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
          {order.map(([code, list]) => {
            const meta = LABELS[code];
            const amount = list.reduce((s, i) => s + (i.amount ?? 0), 0);
            const isOpen = open === code;
            return (
              <li key={code} className="py-3">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : code)}
                  className="row-toggle"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span aria-hidden className="shrink-0" style={{ color: TONE[meta.severity] }}>
                        {meta.severity === 'bad' ? '▲' : meta.severity === 'warn' ? '■' : '●'}
                      </span>
                      {meta.title}
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {meta.effect}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-sm font-semibold">{formatNumber(list.length)} baris</span>
                    {amount > 0 && (
                      <span className="tnum block text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatIDR(amount)}
                      </span>
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-3 overflow-x-auto rounded-md" style={{ background: 'var(--surface-2)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left font-medium">Baris</th>
                          <th className="px-3 py-2 text-left font-medium">Pesanan</th>
                          <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.slice(0, 25).map((i, idx) => (
                          <tr key={`${i.sourceRow}-${idx}`} className="table-row" style={{ borderTop: '1px solid var(--hairline)' }}>
                            <td className="tnum px-3 py-2">{i.sourceRow}</td>
                            <td className="px-3 py-2 font-mono">{i.orderId || '—'}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                              {i.detail}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {list.length > 25 && (
                      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Menampilkan 25 dari {formatNumber(list.length)} baris.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
