/**
 * CLI verifier: membaca CSV lewat pipeline yang SAMA dengan yang dipakai UI,
 * lalu mencetak angka akhir.
 *
 * Gunanya: angka di README tidak diketik tangan dari layar. Angka itu keluaran
 * perintah ini, jadi bisa diulang dan dicek siapa pun.
 *
 *   npm run verify -- data/biota_orders_oct2026.csv
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsvText } from '../lib/csv';
import { cleanRows } from '../lib/clean';
import { aggregate, dateBounds } from '../lib/aggregate';
import { formatIDR, formatNumber } from '../lib/format';
import type { IssueCode } from '../lib/types';

const path = process.argv[2];
if (!path) {
  console.error('Pemakaian: npm run verify -- <file.csv>');
  process.exit(1);
}

const text = readFileSync(resolve(path), 'utf8');
const parsed = parseCsvText(text);
const { lines, issues, stats } = cleanRows(parsed.rows, parsed.headers, parsed.mappedHeaders);

const bounds = dateBounds(lines);
const hr = (label: string) => console.log(`\n${label}\n${'-'.repeat(label.length)}`);

console.log(`File     : ${resolve(path)}`);
console.log(`Rentang  : ${bounds ? `${bounds.min} s/d ${bounds.max}` : '(tidak ada baris valid)'}`);

hr('1. Pembacaan file');
console.log(`Baris mentah (tanpa header) : ${formatNumber(stats.rawRows)}`);
console.log(`Duplikat identik dibuang    : ${formatNumber(stats.duplicateRows)}`);
console.log(`Baris tidak terpakai        : ${formatNumber(stats.droppedRows)}`);
console.log(`Baris dipakai menghitung    : ${formatNumber(stats.keptRows)}`);
if (stats.unmappedHeaders.length) console.log(`Kolom tidak dikenali        : ${stats.unmappedHeaders.join(', ')}`);
if (stats.missingHeaders.length) console.log(`Kolom wajib hilang          : ${stats.missingHeaders.join(', ')}`);
if (parsed.parseErrors.length) console.log(`Error parser                : ${parsed.parseErrors.join(' | ')}`);

const counts = new Map<IssueCode, { n: number; amount: number }>();
for (const i of issues) {
  const c = counts.get(i.code) ?? { n: 0, amount: 0 };
  c.n += 1;
  c.amount += i.amount ?? 0;
  counts.set(i.code, c);
}
hr('2. Catatan kualitas data');
if (counts.size === 0) console.log('(tidak ada)');
for (const [code, c] of [...counts.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`${code.padEnd(28)} ${String(c.n).padStart(4)} baris   ${formatIDR(c.amount)}`);
}

/** Cetak satu skenario perhitungan. */
function report(title: string, opts: Parameters<typeof aggregate>[1]) {
  const agg = aggregate(lines, opts);
  hr(title);
  console.log(`TOTAL NET REVENUE : ${formatIDR(agg.totals.netRevenue)}`);
  console.log(`Unit terjual      : ${formatNumber(agg.totals.units)}`);
  console.log(`Pesanan           : ${formatNumber(agg.totals.orders)}`);
  console.log(`Gross (semua baris): ${formatIDR(agg.totals.grossRevenue)}`);
  console.log('Tidak dihitung:');
  for (const [k, v] of Object.entries(agg.totals.excluded)) {
    if (v > 0) console.log(`  - ${k.padEnd(16)} ${formatIDR(v)}`);
  }
  console.log('\nNet revenue per channel:');
  for (const c of agg.byChannel) {
    console.log(
      `  ${c.channel.padEnd(13)} ${formatIDR(c.netRevenue).padStart(16)}  ${String(c.units).padStart(4)} unit  ${String(
        c.orders,
      ).padStart(4)} pesanan`,
    );
  }
  console.log('\n10 produk teratas (net revenue):');
  agg.topProducts.forEach((p, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${p.sku.padEnd(13)} ${formatIDR(p.netRevenue).padStart(16)}  ${String(
        p.units,
      ).padStart(4)} unit  ${p.productName}`,
    );
  });
  return agg;
}

report('3. Seluruh periode (1-31 Oktober 2026)', {});
report('4. Periode 1-15 Oktober 2026', { from: '2026-10-01', to: '2026-10-15' });
report('5. Periode 16-31 Oktober 2026', { from: '2026-10-16', to: '2026-10-31' });

// Pemeriksaan silang: 1-15 + 16-31 harus sama dengan total sebulan.
hr('6. Pemeriksaan silang');
const full = aggregate(lines, {}).totals.netRevenue;
const h1 = aggregate(lines, { from: '2026-10-01', to: '2026-10-15' }).totals.netRevenue;
const h2 = aggregate(lines, { from: '2026-10-16', to: '2026-10-31' }).totals.netRevenue;
const byChannelSum = aggregate(lines, {}).byChannel.reduce((s, c) => s + c.netRevenue, 0);
const byProductSum = aggregate(lines, {}).byProduct.reduce((s, p) => s + p.netRevenue, 0);
const checks: Array<[string, boolean, string]> = [
  ['paruh-1 + paruh-2 == total bulan', Math.abs(h1 + h2 - full) < 1, `${formatIDR(h1)} + ${formatIDR(h2)} = ${formatIDR(h1 + h2)} vs ${formatIDR(full)}`],
  ['jumlah per channel == total', Math.abs(byChannelSum - full) < 1, `${formatIDR(byChannelSum)} vs ${formatIDR(full)}`],
  ['jumlah per produk == total', Math.abs(byProductSum - full) < 1, `${formatIDR(byProductSum)} vs ${formatIDR(full)}`],
];
let ok = true;
for (const [label, pass, detail] of checks) {
  console.log(`${pass ? 'OK  ' : 'GAGAL'} ${label.padEnd(34)} ${detail}`);
  if (!pass) ok = false;
}
console.log(`\n${ok ? 'Semua pemeriksaan silang lolos.' : 'ADA PEMERIKSAAN YANG GAGAL.'}`);
process.exit(ok ? 0 : 1);
