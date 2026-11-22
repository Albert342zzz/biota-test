'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, StatTile, BarRow } from '@/components/primitives';
import { UploadZone } from '@/components/UploadZone';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { DataQualityPanel } from '@/components/DataQualityPanel';
import { parseCsvText } from '@/lib/csv';
import { cleanRows } from '@/lib/clean';
import { aggregate, dateBounds } from '@/lib/aggregate';
import { formatDateKey, formatIDR, formatIDRCompact, formatNumber, formatPercent } from '@/lib/format';
import type { Channel, CleanResult } from '@/lib/types';

const CHANNEL_COLOR: Record<Channel, string> = {
  Shopee: 'var(--series-1)',
  'TikTok Shop': 'var(--series-2)',
  Tokopedia: 'var(--series-3)',
  Unknown: 'var(--series-unknown)',
};

export default function Page() {
  const [result, setResult] = useState<CleanResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [includePending, setIncludePending] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const load = useCallback((text: string, name: string) => {
    setBusy(true);
    setError(null);
    try {
      const parsed = parseCsvText(text);
      if (parsed.rows.length === 0) {
        setError(parsed.parseErrors[0] ?? 'Tidak ada baris data yang bisa dibaca dari file ini.');
        setResult(null);
        return;
      }
      const cleaned = cleanRows(parsed.rows, parsed.headers, parsed.mappedHeaders);
      setResult(cleaned);
      setFileName(name);
      const bounds = dateBounds(cleaned.lines);
      setRange(bounds ? { from: bounds.min, to: bounds.max } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membaca file.');
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => load(String(reader.result ?? ''), file.name);
      reader.onerror = () => setError('File tidak bisa dibaca.');
      reader.readAsText(file);
    },
    [load],
  );

  const onSample = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/sample/biota_orders_oct2026_sample.csv');
      load(await res.text(), 'biota_orders_oct2026_sample.csv (contoh)');
    } catch {
      setError('Data contoh gagal dimuat.');
      setBusy(false);
    }
  }, [load]);

  const bounds = useMemo(() => (result ? dateBounds(result.lines) : null), [result]);

  const agg = useMemo(() => {
    if (!result) return null;
    return aggregate(result.lines, {
      from: range?.from ?? null,
      to: range?.to ?? null,
      includePendingPayment: includePending,
      topN: 10,
    });
  }, [result, range, includePending]);

  const hasPending = useMemo(
    () => result?.lines.some((l) => l.status === 'pending_payment') ?? false,
    [result],
  );

  const maxChannel = agg ? Math.max(...agg.byChannel.map((c) => c.netRevenue), 0) : 0;
  const maxProduct = agg?.topProducts[0]?.netRevenue ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Penjualan BIOTA</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Net revenue per channel dan per produk dari ekspor Shopee, TikTok Shop dan Tokopedia.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          className="rounded-md px-3 py-1.5 text-xs font-medium"
          style={{ boxShadow: '0 0 0 1px var(--baseline)', color: 'var(--text-secondary)' }}
        >
          Ganti tema
        </button>
      </header>

      <div className="mb-6">
        <UploadZone onFile={onFile} onSample={onSample} busy={busy} fileName={fileName} />
      </div>

      {error && (
        <div
          className="mb-6 rounded-xl p-4 text-sm"
          style={{ background: 'var(--surface-1)', boxShadow: '0 0 0 1px var(--status-critical)' }}
        >
          <strong style={{ color: 'var(--status-critical)' }}>Gagal memproses file.</strong> {error}
        </div>
      )}

      {!result && !error && (
        <Card title="Cara kerjanya">
          <ol
            className="list-decimal space-y-1.5 pl-5 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <li>Upload satu file CSV gabungan dari ketiga marketplace.</li>
            <li>
              Baris kembar dibuang, penulisan channel disatukan, format harga dan tanggal yang
              berbeda-beda dibaca, dan kode produk yang kosong dipulihkan dari nama listing.
            </li>
            <li>
              <strong>Net revenue</strong> dihitung dari pesanan yang <em>tidak</em> dibatalkan dan{' '}
              <em>tidak</em> diretur. Pesanan selesai maupun yang masih dalam pengiriman tetap
              dihitung.
            </li>
            <li>Setiap baris yang tidak dihitung muncul di panel kualitas data, bukan dibuang diam-diam.</li>
          </ol>
        </Card>
      )}

      {result && agg && bounds && range && (
        <div className="space-y-6">
          <Card title="Rentang tanggal" subtitle={`Data tersedia ${formatDateKey(bounds.min)} – ${formatDateKey(bounds.max)}. Kedua ujung filter ikut terhitung.`}>
            <DateRangeFilter
              min={bounds.min}
              max={bounds.max}
              from={range.from}
              to={range.to}
              onChange={(from, to) => setRange({ from, to })}
            />
            {hasPending && (
              <label className="mt-4 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includePending}
                  onChange={(e) => setIncludePending(e.target.checked)}
                  className="mt-0.5"
                />
                <span style={{ color: 'var(--text-secondary)' }}>
                  Ikut hitung pesanan yang belum dibayar. Brief hanya mengecualikan pesanan yang
                  dibatalkan dan diretur, jadi default-nya ikut dihitung.
                </span>
              </label>
            )}
          </Card>

          {/* Angka utama: tepat satu hero figure per halaman. */}
          <section
            className="rounded-xl p-5 sm:p-6"
            style={{ background: 'var(--surface-1)', boxShadow: '0 0 0 1px var(--ring)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Net revenue {formatDateKey(range.from)} – {formatDateKey(range.to)}
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-tight">
              {formatIDR(agg.totals.netRevenue)}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatNumber(agg.totals.units)} unit terjual · {formatNumber(agg.totals.orders)} pesanan
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Nilai dibatalkan"
              value={formatIDRCompact(agg.totals.excluded.cancelled)}
              note={`${formatPercent(agg.totals.excluded.cancelled, agg.totals.grossRevenue)} dari gross`}
              tone="critical"
            />
            <StatTile
              label="Nilai diretur / refund"
              value={formatIDRCompact(agg.totals.excluded.returned)}
              note={`${formatPercent(agg.totals.excluded.returned, agg.totals.grossRevenue)} dari gross`}
              tone="critical"
            />
            <StatTile
              label="Status tidak dikenali"
              value={formatIDRCompact(agg.totals.excluded.unknown)}
              note={agg.totals.excluded.unknown > 0 ? 'Tidak dihitung — perlu dicek' : 'Tidak ada'}
              tone={agg.totals.excluded.unknown > 0 ? 'critical' : 'muted'}
            />
            <StatTile
              label="Gross (semua status)"
              value={formatIDRCompact(agg.totals.grossRevenue)}
              note="Termasuk batal & retur"
              tone="muted"
            />
          </div>

          <Card
            title="Net revenue per channel"
            subtitle="Nama channel tertulis langsung di tiap bar, jadi warna bukan satu-satunya penanda."
          >
            <div>
              {agg.byChannel.map((c) => (
                <BarRow
                  key={c.channel}
                  label={c.channel}
                  value={c.netRevenue}
                  valueLabel={formatIDR(c.netRevenue)}
                  sublabel={`${formatPercent(c.netRevenue, agg.totals.netRevenue)} · ${formatNumber(c.units)} unit · ${formatNumber(c.orders)} pesanan`}
                  max={maxChannel}
                  color={CHANNEL_COLOR[c.channel]}
                  title={`${c.channel}: ${formatIDR(c.netRevenue)}, ${c.units} unit, ${c.orders} pesanan`}
                />
              ))}
            </div>
          </Card>

          <Card
            title="10 produk teratas"
            subtitle="Diurutkan berdasarkan net revenue. Produk dikelompokkan per SKU, bukan per nama listing — satu produk bisa punya nama berbeda di tiap marketplace."
          >
            {agg.topProducts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Tidak ada penjualan pada rentang tanggal ini.
              </p>
            ) : (
              <div>
                {agg.topProducts.map((p, i) => (
                  <BarRow
                    key={p.sku}
                    rank={i + 1}
                    label={p.productName}
                    value={p.netRevenue}
                    valueLabel={formatIDR(p.netRevenue)}
                    sublabel={`${formatNumber(p.units)} unit`}
                    max={maxProduct}
                    color="var(--series-1)"
                    title={`${p.sku} — ${p.productName}\n${formatIDR(p.netRevenue)} · ${p.units} unit · ${p.orders} pesanan\nChannel: ${p.channels.join(', ')}${p.aliases.length ? `\nNama lain: ${p.aliases.join(' | ')}` : ''}`}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Semua produk"
            subtitle={`${formatNumber(agg.byProduct.length)} SKU terjual pada rentang ini. Tabel ini adalah tampilan angka lengkap dari grafik di atas.`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--baseline)' }}>
                    <th className="px-2 py-2 text-left font-medium">SKU</th>
                    <th className="px-2 py-2 text-left font-medium">Produk</th>
                    <th className="px-2 py-2 text-right font-medium">Net revenue</th>
                    <th className="px-2 py-2 text-right font-medium">Unit</th>
                    <th className="px-2 py-2 text-right font-medium">Pesanan</th>
                    <th className="px-2 py-2 text-left font-medium">Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.byProduct.map((p) => (
                    <tr key={p.sku} style={{ borderBottom: '1px solid var(--hairline)' }}>
                      <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">{p.sku}</td>
                      <td className="px-2 py-2">{p.productName}</td>
                      <td className="tnum px-2 py-2 text-right font-medium">{formatIDR(p.netRevenue)}</td>
                      <td className="tnum px-2 py-2 text-right">{formatNumber(p.units)}</td>
                      <td className="tnum px-2 py-2 text-right">{formatNumber(p.orders)}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {p.channels.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--baseline)' }}>
                    <td className="px-2 py-2 font-semibold" colSpan={2}>
                      Total
                    </td>
                    <td className="tnum px-2 py-2 text-right font-semibold">{formatIDR(agg.totals.netRevenue)}</td>
                    <td className="tnum px-2 py-2 text-right font-semibold">{formatNumber(agg.totals.units)}</td>
                    <td className="tnum px-2 py-2 text-right font-semibold">{formatNumber(agg.totals.orders)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Kolom <strong>Unit</strong> dan <strong>Net revenue</strong> dijumlahkan ke baris Total.
              Kolom <strong>Pesanan</strong> tidak: satu pesanan bisa berisi beberapa produk, jadi
              pesanan yang sama ikut terhitung di lebih dari satu baris. Baris Total menampilkan
              jumlah pesanan unik.
            </p>
          </Card>

          <Card
            title="Kualitas data"
            subtitle="Setiap baris yang diubah atau tidak dihitung tercatat di sini. Klik satu baris untuk melihat nomor barisnya di file asli."
          >
            <DataQualityPanel result={result} />
          </Card>
        </div>
      )}
    </main>
  );
}
