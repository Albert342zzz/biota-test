// Mengukur dampak rupiah dari dua bug yang benar-benar terjadi di sesi ini.
import { readFileSync } from 'node:fs';
import { parseCsvText } from '../lib/csv';
import { cleanRows } from '../lib/clean';
import { aggregate } from '../lib/aggregate';
import { formatIDR } from '../lib/format';

const text = readFileSync('/home/user/data-asli/biota_orders_oct2026.csv', 'utf8');
const p = parseCsvText(text);
const benar = aggregate(cleanRows(p.rows, p.headers, p.mappedHeaders).lines, {}).totals.netRevenue;

// Bug A: baris dengan sku kosong dibuang (perilaku versi pertama).
const tanpaSkuKosong = p.rows.filter((r) => (r.sku ?? '').trim() !== '');
const a = aggregate(cleanRows(tanpaSkuKosong, p.headers, p.mappedHeaders).lines, {}).totals.netRevenue;

// Bug B: format "Oct 21, 2026" tidak dikenali -> baris dibuang.
const tanpaOct = p.rows.filter((r) => !/^[A-Za-z]{3}\s/.test((r.order_date ?? '').trim()));
const b = aggregate(cleanRows(tanpaOct, p.headers, p.mappedHeaders).lines, {}).totals.netRevenue;

// Keduanya sekaligus (kondisi kode sebelum CSV asli masuk).
const keduanya = p.rows.filter(
  (r) => (r.sku ?? '').trim() !== '' && !/^[A-Za-z]{3}\s/.test((r.order_date ?? '').trim()),
);
const ab = aggregate(cleanRows(keduanya, p.headers, p.mappedHeaders).lines, {}).totals.netRevenue;

const pct = (x: number) => `${(((benar - x) / benar) * 100).toFixed(1)}%`;
console.log(`Angka benar                       : ${formatIDR(benar)}`);
console.log(`Bug A (sku kosong dibuang)        : ${formatIDR(a)}   kurang ${formatIDR(benar - a)} (${pct(a)})`);
console.log(`Bug B (format "Oct 7, 2026")      : ${formatIDR(b)}   kurang ${formatIDR(benar - b)} (${pct(b)})`);
console.log(`Kedua bug sekaligus               : ${formatIDR(ab)}   kurang ${formatIDR(benar - ab)} (${pct(ab)})`);
console.log(`\nBaris berformat "Mon D, YYYY"     : ${p.rows.length - tanpaOct.length}`);
console.log(`Baris sku kosong                  : ${p.rows.length - tanpaSkuKosong.length}`);
