/**
 * Normalisasi nilai mentah dari ekspor marketplace.
 *
 * Semua fungsi di file ini PURE: satu input string -> satu output.
 * Tidak ada akses DOM, tidak ada I/O. Supaya bisa di-test dan dipakai
 * baik oleh UI (browser) maupun oleh CLI verifier (Node).
 */

import { CHANNELS, type Channel, type StatusBucket } from './types';

/* ------------------------------------------------------------------ *
 * Header kolom
 * ------------------------------------------------------------------ */

/** Nama kanonik kolom yang kami butuhkan. */
export const CANONICAL_COLUMNS = [
  'order_id',
  'order_date',
  'channel',
  'sku',
  'product_name',
  'qty',
  'unit_price',
  'total_price',
  'status',
  'buyer_city',
] as const;

export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number];

/**
 * Alias header. Ekspor marketplace sering memakai judul kolom yang berbeda
 * (spasi, kapital, bahasa Indonesia). Kunci map sudah dalam bentuk ter-slug.
 */
const HEADER_ALIASES: Record<string, CanonicalColumn> = {
  order_id: 'order_id',
  orderid: 'order_id',
  no_pesanan: 'order_id',
  nomor_pesanan: 'order_id',
  order_number: 'order_id',
  invoice: 'order_id',

  order_date: 'order_date',
  orderdate: 'order_date',
  tanggal: 'order_date',
  tanggal_pesanan: 'order_date',
  waktu_pesanan_dibuat: 'order_date',
  created_time: 'order_date',

  channel: 'channel',
  marketplace: 'channel',
  platform: 'channel',
  toko: 'channel',

  sku: 'sku',
  sku_induk: 'sku',
  nomor_referensi_sku: 'sku',
  seller_sku: 'sku',
  kode_produk: 'sku',

  product_name: 'product_name',
  productname: 'product_name',
  nama_produk: 'product_name',
  product: 'product_name',

  qty: 'qty',
  quantity: 'qty',
  jumlah: 'qty',
  jumlah_unit: 'qty',

  unit_price: 'unit_price',
  unitprice: 'unit_price',
  harga: 'unit_price',
  harga_satuan: 'unit_price',
  price: 'unit_price',

  total_price: 'total_price',
  totalprice: 'total_price',
  total: 'total_price',
  subtotal: 'total_price',
  total_harga: 'total_price',

  status: 'status',
  order_status: 'status',
  status_pesanan: 'status',

  buyer_city: 'buyer_city',
  buyercity: 'buyer_city',
  kota: 'buyer_city',
  kota_pembeli: 'buyer_city',
  city: 'buyer_city',
};

/** "  Order ID " -> "order_id" (slug), lalu dicocokkan ke alias. */
export function slugifyHeader(raw: string): string {
  return raw
    .replace(/^﻿/, '') // BOM dari ekspor Excel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function mapHeader(raw: string): CanonicalColumn | null {
  return HEADER_ALIASES[slugifyHeader(raw)] ?? null;
}

/* ------------------------------------------------------------------ *
 * Channel
 * ------------------------------------------------------------------ */

const CHANNEL_PATTERNS: Array<[RegExp, Channel]> = [
  [/^shopee/, 'Shopee'],
  [/^(tiktok|tik_?tok|tts)/, 'TikTok Shop'],
  [/^(tokopedia|toped|tokped|tkp)/, 'Tokopedia'],
];

/** Toleran terhadap kapital, spasi ganda, dan singkatan. */
export function normalizeChannel(raw: string | null | undefined): Channel {
  const key = (raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!key) return 'Unknown';
  for (const [pattern, channel] of CHANNEL_PATTERNS) {
    if (pattern.test(key)) return channel;
  }
  // Pencocokan persis sebagai jaring terakhir.
  const exact = CHANNELS.find((c) => c.toLowerCase().replace(/\s+/g, '') === key);
  return exact ?? 'Unknown';
}

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

/**
 * Pemetaan status -> bucket.
 *
 * Diurutkan dari yang paling spesifik ke paling umum. Pola dicocokkan pada
 * status yang sudah di-lowercase dan dirapikan spasinya.
 *
 * PENTING: pola "batal" harus diuji SEBELUM "selesai"/"kirim", karena ekspor
 * memakai frasa seperti "Pengiriman Dibatalkan" yang mengandung dua kata kunci.
 */
const STATUS_PATTERNS: Array<[RegExp, StatusBucket]> = [
  // --- Dibatalkan -------------------------------------------------
  [/\b(batal|dibatalkan|pembatalan|cancel+ed|cancel|canceled)\b/, 'cancelled'],
  [/\b(gagal|failed|gagal kirim|delivery failed|tidak terkirim)\b/, 'cancelled'],
  // --- Retur / refund ---------------------------------------------
  [/\b(retur|dikembalikan|pengembalian|refund(ed)?|return(ed)?|dana dikembalikan)\b/, 'returned'],
  // --- Belum dibayar ----------------------------------------------
  [/\b(belum bayar|belum dibayar|menunggu pembayaran|unpaid|pending payment|waiting for payment|menunggu konfirmasi pembayaran)\b/, 'pending_payment'],
  // --- Selesai -----------------------------------------------------
  [/\b(selesai|complete(d)?|done|diterima|delivered|terkirim|pesanan selesai)\b/, 'completed'],
  // --- Masih jalan -------------------------------------------------
  [/\b(dikirim|dalam pengiriman|sedang dikirim|pengiriman|shipping|shipped|in transit|on delivery|dikemas|diproses|perlu dikirim|siap dikirim|to ship|processing|in progress|baru|paid|dibayar)\b/, 'in_progress'],
];

export function classifyStatus(raw: string | null | undefined): StatusBucket {
  const key = (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return 'unknown';
  for (const [pattern, bucket] of STATUS_PATTERNS) {
    if (pattern.test(key)) return bucket;
  }
  return 'unknown';
}

/**
 * Bucket mana yang dihitung sebagai net revenue.
 *
 * Definisi brief: "pendapatan dari pesanan yang tidak dibatalkan dan tidak
 * diretur. Pesanan yang sudah selesai maupun yang masih dalam pengiriman tetap
 * dihitung."
 *
 * `unknown` TIDAK pernah dihitung: lebih baik angkanya kurang dan masalahnya
 * terlihat, daripada diam-diam masuk dan angkanya salah.
 */
export function isNetRevenue(
  bucket: StatusBucket,
  opts: { includePendingPayment: boolean },
): boolean {
  if (bucket === 'completed' || bucket === 'in_progress') return true;
  if (bucket === 'pending_payment') return opts.includePendingPayment;
  return false;
}

/* ------------------------------------------------------------------ *
 * Uang
 * ------------------------------------------------------------------ */

/**
 * Parse nilai rupiah dari ekspor marketplace.
 *
 * Bentuk yang ditangani:
 *   "Rp699.000"      -> 699000   (format Indonesia, titik = ribuan)
 *   "Rp 1.299.000"   -> 1299000
 *   "699,000"        -> 699000   (format Inggris, koma = ribuan)
 *   "699.000,50"     -> 699000.5 (Indonesia dengan desimal)
 *   "699,000.50"     -> 699000.5 (Inggris dengan desimal)
 *   "699000"         -> 699000
 *   "(699.000)"      -> -699000  (notasi akuntansi untuk negatif)
 *   "-", "", "N/A"   -> null
 *
 * Aturan ambiguitas (didokumentasikan di README):
 *  - Jika ADA titik dan koma, pemisah yang muncul TERAKHIR adalah desimal.
 *  - Jika hanya satu jenis pemisah dan muncul >1 kali -> pemisah ribuan.
 *  - Jika hanya satu jenis pemisah, muncul 1 kali, dan diikuti TEPAT 3 digit
 *    -> pemisah ribuan. (IDR praktis tidak punya pecahan sen, jadi "699.000"
 *    jauh lebih mungkin 699 ribu daripada 699 rupiah 0 sen.)
 *  - Selain itu -> pemisah desimal.
 */
export function parseRupiah(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  let s = (raw ?? '').toString().trim();
  if (!s) return null;

  // Buang simbol mata uang dan spasi (termasuk non-breaking space).
  s = s.replace(/ /g, ' ').replace(/rp\.?/gi, '').replace(/idr/gi, '').trim();

  // Notasi akuntansi: (1.000) berarti negatif.
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1).trim();
  }

  if (!s || !/\d/.test(s)) return null; // "-", "N/A", "TIDAK ADA"

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  let decimalSep: '.' | ',' | null = null;

  if (hasDot && hasComma) {
    decimalSep = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const occurrences = s.split(sep).length - 1;
    const tail = s.slice(s.lastIndexOf(sep) + 1);
    decimalSep = occurrences > 1 || /^\d{3}$/.test(tail) ? null : sep;
  }

  // Hilangkan semua pemisah ribuan, lalu normalkan desimal ke titik.
  let cleaned: string;
  if (decimalSep === null) {
    cleaned = s.replace(/[.,]/g, '');
  } else {
    const thousandSep = decimalSep === '.' ? ',' : '.';
    cleaned = s.split(thousandSep).join('').replace(decimalSep, '.');
  }
  cleaned = cleaned.replace(/[^0-9.]/g, '');

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/* ------------------------------------------------------------------ *
 * Qty
 * ------------------------------------------------------------------ */

/** Mengembalikan null kalau bukan bilangan bulat positif yang masuk akal. */
export function parseQty(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = raw.toString().trim().replace(/ /g, '');
  if (!s) return null;
  // "1.0" / "1,0" dari Excel tetap berarti 1 unit.
  const n = Number.parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  if (Math.abs(n - Math.round(n)) > 1e-9) return null; // 1,5 unit tidak valid
  return Math.round(n);
}

/* ------------------------------------------------------------------ *
 * Tanggal
 * ------------------------------------------------------------------ */

export interface ParsedDate {
  /** "YYYY-MM-DD" */
  dateKey: string;
  /** "HH:MM" atau null */
  time: string | null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  des: 12, dec: 12, desember: 12, december: 12,
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (y < 2000 || y > 2100) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/**
 * Parse tanggal pesanan TANPA menyentuh `new Date(string)`.
 *
 * Alasan (ini bug nyata yang kami temukan, lihat README): `new Date("2026-10-01")`
 * ditafsirkan sebagai UTC tengah malam, sehingga di browser dengan zona WIB
 * (UTC+7) tanggalnya masih 1 Oktober, tapi di server/CI dengan zona negatif
 * nilainya bergeser ke 30 September. Rentang "1-15 Oktober" jadi salah.
 *
 * Solusinya: ambil komponen tanggal apa adanya sebagai teks dan bandingkan
 * sebagai string "YYYY-MM-DD". Tidak ada konversi timezone sama sekali.
 *
 * Format yang ditangani:
 *   2026-10-20 08:20        (format utama di file ekspor)
 *   2026-10-20T08:20:00Z
 *   2026/10/20
 *   20/10/2026 08:20        (dd/mm/yyyy — asumsi locale Indonesia)
 *   20-10-2026
 *   20 Okt 2026
 *   45950                   (serial number Excel, kalau file lewat Excel)
 */
export function parseOrderDate(raw: string | number | null | undefined): ParsedDate | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.toString().trim();
  if (!s) return null;

  // Serial Excel (hari sejak 1899-12-30). Hanya dipakai kalau nilainya murni angka.
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number.parseFloat(s);
    const ms = Math.round((serial - 25569) * 86400000);
    const dt = new Date(ms); // dibaca kembali sebagai UTC -> aman
    if (!Number.isNaN(dt.getTime())) {
      const frac = serial - Math.floor(serial);
      const minutes = Math.round(frac * 1440);
      return {
        dateKey: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
        time: frac > 0 ? `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` : null,
      };
    }
  }

  // Pisahkan bagian tanggal dan jam.
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  const time = timeMatch
    ? `${pad(Number(timeMatch[1]))}:${timeMatch[2]}`
    : null;
  const datePart = s.split(/[T\s]/)[0];

  // ISO: yyyy-mm-dd atau yyyy/mm/dd
  let m = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (isRealDate(y, mo, d)) return { dateKey: `${y}-${pad(mo)}-${pad(d)}`, time };
    return null;
  }

  // dd/mm/yyyy atau dd-mm-yyyy. ASUMSI: hari di depan (locale Indonesia).
  m = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    let [d, mo] = [Number(m[1]), Number(m[2])];
    const y = Number(m[3]);
    // Kalau angka pertama > 12, pasti hari. Kalau angka kedua > 12, pasti
    // mm/dd/yyyy dan kita tukar supaya tidak membuang baris.
    if (d <= 12 && mo > 12) [d, mo] = [mo, d];
    if (isRealDate(y, mo, d)) return { dateKey: `${y}-${pad(mo)}-${pad(d)}`, time };
    return null;
  }

  // "20 Okt 2026" / "20 October 2026"
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (m) {
    const mo = MONTH_NAMES[m[2].toLowerCase()];
    const d = Number(m[1]);
    const y = Number(m[3]);
    if (mo && isRealDate(y, mo, d)) return { dateKey: `${y}-${pad(mo)}-${pad(d)}`, time };
  }

  // "Oct 21, 2026" / "Oktober 21 2026" — format yang dipakai salah satu
  // ekspor di file asli. Bulan di depan, tanggal pakai koma.
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mo = MONTH_NAMES[m[1].toLowerCase()];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mo && isRealDate(y, mo, d)) return { dateKey: `${y}-${pad(mo)}-${pad(d)}`, time };
  }

  return null;
}

/** Normalisasi teks umum: trim + rapikan spasi ganda. */
export function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').toString().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Kunci pencocokan nama listing -> SKU.
 *
 * Dipakai untuk memulihkan `sku` yang kosong. Sengaja TIDAK fuzzy: hanya
 * huruf/angka yang disamakan, sisanya dibuang. Pencocokan longgar berisiko
 * menyatukan dua produk berbeda, dan itu jauh lebih mahal daripada satu baris
 * yang tidak terpulihkan.
 */
export function productNameKey(raw: string | null | undefined): string {
  return cleanText(raw).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
