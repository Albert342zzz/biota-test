/**
 * Tipe data inti dashboard.
 *
 * Catatan desain: tanggal disimpan sebagai STRING "YYYY-MM-DD" (dateKey), bukan
 * objek Date. Alasannya di README (bug timezone). Perbandingan rentang tanggal
 * dilakukan secara leksikografis pada dateKey sehingga bebas dari pengaruh
 * timezone server maupun browser.
 */

export const CHANNELS = ['Shopee', 'TikTok Shop', 'Tokopedia'] as const;
export type Channel = (typeof CHANNELS)[number] | 'Unknown';

/** Hasil klasifikasi kolom `status` ke dalam bucket yang punya arti bisnis. */
export type StatusBucket =
  /** Pesanan selesai / sudah diterima pembeli. Masuk net revenue. */
  | 'completed'
  /** Masih diproses atau dalam pengiriman. Masuk net revenue (sesuai brief). */
  | 'in_progress'
  /** Belum dibayar / menunggu pembayaran. Lihat README: dapat diikutkan atau tidak. */
  | 'pending_payment'
  /** Dibatalkan. Tidak masuk net revenue. */
  | 'cancelled'
  /** Diretur / dikembalikan / refund. Tidak masuk net revenue. */
  | 'returned'
  /** Status tidak dikenali. Tidak masuk net revenue, tapi dilaporkan ke user. */
  | 'unknown';

/** Satu baris pesanan yang sudah dibersihkan dan siap diagregasi. */
export interface OrderLine {
  /** Nomor baris di file asli (1-based, tidak termasuk header) — untuk audit. */
  sourceRow: number;
  orderId: string;
  /** "YYYY-MM-DD" waktu lokal sesuai yang tertulis di file. */
  dateKey: string;
  /** "HH:MM" bila ada di file, kalau tidak null. */
  time: string | null;
  channel: Channel;
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  /** Nilai baris yang dipakai untuk semua perhitungan (lihat README: aturan rekonsiliasi). */
  lineRevenue: number;
  /** Nilai `total_price` apa adanya dari file, null bila kosong/tidak terbaca. */
  reportedTotal: number | null;
  statusRaw: string;
  status: StatusBucket;
  /** true bila `sku` kosong di file dan dipulihkan dari `product_name`. */
  skuRecovered: boolean;
  buyerCity: string;
}

/** Kategori masalah data yang kami laporkan ke pengguna, bukan kami sembunyikan. */
export type IssueCode =
  | 'missing_order_id'
  | 'unparsable_date'
  | 'unknown_channel'
  | 'missing_sku'
  | 'sku_recovered_from_name'
  | 'invalid_qty'
  | 'unparsable_price'
  | 'total_mismatch'
  | 'unknown_status'
  | 'duplicate_row'
  | 'mixed_status_in_order'
  | 'date_outside_dominant_month';

export interface Issue {
  code: IssueCode;
  sourceRow: number;
  orderId: string;
  detail: string;
  /** Rupiah yang terdampak, bila relevan — supaya dampaknya bisa dinilai. */
  amount?: number;
}

export interface CleanResult {
  lines: OrderLine[];
  issues: Issue[];
  stats: {
    rawRows: number;
    duplicateRows: number;
    droppedRows: number;
    keptRows: number;
    /** Kolom yang ada di file tapi tidak kami kenali. */
    unmappedHeaders: string[];
    /** Kolom wajib yang tidak ditemukan. */
    missingHeaders: string[];
  };
}

export interface ChannelAgg {
  channel: Channel;
  netRevenue: number;
  units: number;
  orders: number;
}

export interface ProductAgg {
  sku: string;
  productName: string;
  /** Nama listing lain untuk SKU yang sama (beda channel sering beda nama). */
  aliases: string[];
  netRevenue: number;
  units: number;
  orders: number;
  channels: Channel[];
}

export interface Totals {
  netRevenue: number;
  units: number;
  orders: number;
  /** Rupiah yang dikeluarkan dari net revenue, per alasan. */
  excluded: Record<Exclude<StatusBucket, 'completed' | 'in_progress'>, number>;
  grossRevenue: number;
}

export interface Aggregates {
  totals: Totals;
  byChannel: ChannelAgg[];
  byProduct: ProductAgg[];
  topProducts: ProductAgg[];
}
