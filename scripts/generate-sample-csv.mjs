/**
 * Membuat CSV contoh yang karakternya seperti ekspor marketplace asli,
 * supaya dashboard bisa dicoba tanpa data perusahaan.
 *
 * PRNG-nya deterministik (seed tetap), jadi file yang dihasilkan selalu sama
 * dan angka di README bisa direproduksi.
 *
 * Quirks yang sengaja dimasukkan — semuanya hal yang benar-benar muncul di
 * ekspor Shopee/TikTok/Tokopedia:
 *   - kosakata status berbeda per channel, campur Indonesia dan Inggris
 *   - "Pengiriman Dibatalkan" (mengandung dua kata kunci sekaligus)
 *   - format tanggal dd/mm/yyyy di satu channel, yyyy-mm-dd di channel lain
 *   - nama listing berbeda untuk SKU yang sama
 *   - baris duplikat hasil ekspor dobel
 *   - total_price yang lupa dikali qty
 *   - penulisan channel tidak konsisten (tokped, TIKTOK SHOP)
 *   - satu baris sku kosong, satu qty nol, satu status asing, satu channel asing
 *   - satu pesanan nyasar dari bulan sebelumnya
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? 'public/sample/biota_orders_oct2026_sample.csv');

/** PRNG deterministik (mulberry32). */
function rng(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261020);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
};

const PRODUCTS = [
  { sku: 'BIO-CAM-OPZ', price: 699000, names: { Shopee: 'BIOTA Smart Camera Outdoor PTZ - CCTV Outdoor Waterproof', 'TikTok Shop': 'CCTV Outdoor PTZ Waterproof BIOTA - Kamera Pengawas Rumah', Tokopedia: 'BIOTA Smart Camera Outdoor PTZ' } },
  { sku: 'BIO-CAM-IND', price: 349000, names: { Shopee: 'BIOTA Smart Camera Indoor 2K - Baby Monitor', 'TikTok Shop': 'Kamera CCTV Indoor 2K BIOTA Murah', Tokopedia: 'BIOTA Smart Camera Indoor 2K' } },
  { sku: 'BIO-DBELL-01', price: 899000, names: { Shopee: 'BIOTA Video Doorbell 1080p', 'TikTok Shop': 'Bel Pintu Kamera BIOTA Video Doorbell', Tokopedia: 'BIOTA Video Doorbell 1080p Wireless' } },
  { sku: 'BIO-LOCK-PRO', price: 2499000, names: { Shopee: 'BIOTA Smart Door Lock Pro - Fingerprint', 'TikTok Shop': 'Kunci Pintu Digital BIOTA Pro Fingerprint', Tokopedia: 'BIOTA Smart Door Lock Pro' } },
  { sku: 'BIO-PLUG-16A', price: 129000, names: { Shopee: 'BIOTA Smart Plug 16A WiFi', 'TikTok Shop': 'Colokan Pintar BIOTA Smart Plug 16A', Tokopedia: 'BIOTA Smart Plug 16A' } },
  { sku: 'BIO-BULB-RGB', price: 89000, names: { Shopee: 'BIOTA Smart Bulb RGB 9W', 'TikTok Shop': 'Lampu Pintar BIOTA RGB 9W WiFi', Tokopedia: 'BIOTA Smart Bulb RGB 9W' } },
  { sku: 'BIO-SENS-MOT', price: 159000, names: { Shopee: 'BIOTA Motion Sensor PIR', 'TikTok Shop': 'Sensor Gerak BIOTA PIR Wireless', Tokopedia: 'BIOTA Motion Sensor PIR' } },
  { sku: 'BIO-SENS-DOOR', price: 139000, names: { Shopee: 'BIOTA Door & Window Sensor', 'TikTok Shop': 'Sensor Pintu Jendela BIOTA', Tokopedia: 'BIOTA Door Window Sensor' } },
  { sku: 'BIO-HUB-G2', price: 499000, names: { Shopee: 'BIOTA Smart Hub G2 Zigbee', 'TikTok Shop': 'Hub Pintar BIOTA G2 Zigbee', Tokopedia: 'BIOTA Smart Hub G2' } },
  { sku: 'BIO-STRIP-5M', price: 199000, names: { Shopee: 'BIOTA LED Strip 5M RGBIC', 'TikTok Shop': 'Lampu Strip LED BIOTA 5M RGBIC', Tokopedia: 'BIOTA LED Strip 5M RGBIC' } },
  { sku: 'BIO-VAC-S1', price: 1799000, names: { Shopee: 'BIOTA Robot Vacuum S1', 'TikTok Shop': 'Robot Vacuum BIOTA S1 Pel Otomatis', Tokopedia: 'BIOTA Robot Vacuum S1' } },
  { sku: 'BIO-CURT-M1', price: 749000, names: { Shopee: 'BIOTA Smart Curtain Motor M1', 'TikTok Shop': 'Motor Gorden Otomatis BIOTA M1', Tokopedia: 'BIOTA Smart Curtain Motor M1' } },
];

// Kosakata status per channel, dengan bobot supaya proporsinya realistis.
const STATUS_BY_CHANNEL = {
  Shopee: [['Selesai', 62], ['Dikirim', 14], ['Perlu Dikirim', 6], ['Belum Bayar', 5], ['Batal', 9], ['Pengembalian Dana', 4]],
  'TikTok Shop': [['Completed', 60], ['Shipping', 15], ['To Ship', 6], ['Unpaid', 4], ['Cancelled', 10], ['Returned', 5]],
  Tokopedia: [['Pesanan Selesai', 58], ['Dalam Pengiriman', 16], ['Diproses', 7], ['Menunggu Pembayaran', 4], ['Dibatalkan', 10], ['Dikembalikan', 5]],
};

const CHANNEL_SPELLING = {
  Shopee: [['Shopee', 92], ['shopee', 5], ['SHOPEE', 3]],
  'TikTok Shop': [['TikTok Shop', 90], ['Tiktok Shop', 6], ['TIKTOK SHOP', 4]],
  Tokopedia: [['Tokopedia', 92], ['tokopedia', 5], ['tokped', 3]],
};

const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Bekasi', 'Depok', 'Tangerang', 'Semarang', 'Makassar', 'Palembang', 'Yogyakarta', 'Denpasar', 'Malang', 'Bogor', 'Batam'];
const PREFIX = { Shopee: 'SHP', 'TikTok Shop': 'TTS', Tokopedia: 'TKP' };

/** "Rp699.000" */
const rp = (n) => 'Rp' + n.toLocaleString('id-ID');
const pad = (n) => String(n).padStart(2, '0');

/** Tokopedia memakai dd/mm/yyyy di ekspornya; dua channel lain yyyy-mm-dd. */
function formatDate(channel, day, hour, minute) {
  if (channel === 'Tokopedia') return `${pad(day)}/10/2026 ${pad(hour)}:${pad(minute)}`;
  return `2026-10-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

const rows = [];
let counter = 1;

/** Satu pesanan = 1..3 baris produk. */
function makeOrder({ channel, day, forcedStatus = null, lines = null } = {}) {
  const ch = channel ?? weighted([['Shopee', 45], ['TikTok Shop', 33], ['Tokopedia', 22]]);
  const d = day ?? 1 + Math.floor(rand() * 31);
  const hour = 7 + Math.floor(rand() * 15);
  const minute = Math.floor(rand() * 60);
  const orderId = `${PREFIX[ch]}2610${pad(d)}${String(counter++).padStart(3, '0')}`;
  const status = forcedStatus ?? weighted(STATUS_BY_CHANNEL[ch]);
  const lineCount = lines ?? weighted([[1, 72], [2, 20], [3, 8]]);

  const used = new Set();
  const out = [];
  for (let i = 0; i < lineCount; i++) {
    let product = pick(PRODUCTS);
    let guard = 0;
    while (used.has(product.sku) && guard++ < 10) product = pick(PRODUCTS);
    used.add(product.sku);

    const qty = weighted([[1, 80], [2, 14], [3, 6]]);
    // Harga listing bisa beda sedikit per channel (promo, harga coret).
    const unitPrice = Math.round((product.price * (1 - weighted([[0, 70], [0.05, 20], [0.1, 10]]))) / 1000) * 1000;
    out.push({
      order_id: orderId,
      order_date: formatDate(ch, d, hour, minute),
      channel: weighted(CHANNEL_SPELLING[ch]),
      sku: product.sku,
      product_name: product.names[ch],
      qty: String(qty),
      unit_price: rp(unitPrice),
      total_price: rp(unitPrice * qty),
      status,
      buyer_city: pick(CITIES),
    });
  }
  return out;
}

// --- Badan data ------------------------------------------------------
for (let i = 0; i < 330; i++) rows.push(...makeOrder());

// --- Quirks yang disuntikkan dengan sengaja --------------------------

// 1. Frasa status gabungan: mengandung "pengiriman" DAN "dibatalkan".
rows.push(...makeOrder({ channel: 'Shopee', day: 7, forcedStatus: 'Pengiriman Dibatalkan', lines: 1 }));
rows.push(...makeOrder({ channel: 'Tokopedia', day: 19, forcedStatus: 'Selesai - Dikembalikan', lines: 1 }));

// 2. Status yang tidak ada di kamus kami: harus muncul di panel kualitas data.
rows.push(...makeOrder({ channel: 'TikTok Shop', day: 11, forcedStatus: 'In Review', lines: 1 }));
rows.push(...makeOrder({ channel: 'Shopee', day: 23, forcedStatus: 'Sengketa', lines: 1 }));

// 3. total_price lupa dikali qty (4 baris).
for (const day of [4, 12, 18, 27]) {
  const [line] = makeOrder({ day, forcedStatus: 'Selesai', lines: 1, channel: 'Shopee' });
  line.qty = '2';
  line.total_price = line.unit_price; // salah: seharusnya 2x
  rows.push(line);
}

// 4. Satu pesanan dengan status campur (retur sebagian).
const mixed = makeOrder({ channel: 'Shopee', day: 9, forcedStatus: 'Selesai', lines: 2 });
mixed[1].status = 'Pengembalian Dana';
rows.push(...mixed);

// 5. Baris cacat: sku kosong, qty nol, channel asing.
const broken = makeOrder({ channel: 'Shopee', day: 14, forcedStatus: 'Selesai', lines: 1 })[0];
rows.push({ ...broken, order_id: broken.order_id + 'A', sku: '' });
rows.push({ ...broken, order_id: broken.order_id + 'B', qty: '0' });
rows.push({ ...broken, order_id: broken.order_id + 'C', channel: 'Lazada' });

// 6. Pesanan nyasar dari bulan sebelumnya.
const stray = makeOrder({ channel: 'Tokopedia', day: 2, forcedStatus: 'Pesanan Selesai', lines: 1 })[0];
rows.push({ ...stray, order_date: '28/09/2026 16:40', order_id: 'TKP2609028999' });

// 7. Harga kosong tapi total ada, dan sebaliknya.
const noUnit = makeOrder({ channel: 'TikTok Shop', day: 6, forcedStatus: 'Completed', lines: 1 })[0];
rows.push({ ...noUnit, order_id: noUnit.order_id + 'A', unit_price: '' });
const noTotal = makeOrder({ channel: 'TikTok Shop', day: 6, forcedStatus: 'Completed', lines: 1 })[0];
rows.push({ ...noTotal, order_id: noTotal.order_id + 'B', total_price: '-' });

// --- Urutkan seperti ekspor asli (menurut tanggal), lalu dobel 3 baris
rows.sort((a, b) => {
  const key = (r) => {
    const m = r.order_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}${m[2]}${m[3]}`;
    const m2 = r.order_date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m2 ? `${m2[3]}${m2[2]}${m2[1]}` : '00000000';
  };
  return key(a).localeCompare(key(b));
});

// 8. Baris duplikat persis — ekspor yang dijalankan dua kali lalu digabung.
for (const idx of [40, 150, 260]) if (rows[idx]) rows.push({ ...rows[idx] });

const COLUMNS = ['order_id', 'order_date', 'channel', 'sku', 'product_name', 'qty', 'unit_price', 'total_price', 'status', 'buyer_city'];
const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => esc(r[c] ?? '')).join(','))].join('\n') + '\n';

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, csv, 'utf8');
console.log(`${rows.length} baris ditulis ke ${OUT}`);
