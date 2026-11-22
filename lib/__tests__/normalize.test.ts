import { describe, expect, it } from 'vitest';
import {
  classifyStatus,
  isNetRevenue,
  mapHeader,
  normalizeChannel,
  parseOrderDate,
  parseQty,
  parseRupiah,
} from '../normalize';

describe('parseRupiah', () => {
  it('membaca format rupiah dari ekspor marketplace', () => {
    expect(parseRupiah('Rp699.000')).toBe(699000);
    expect(parseRupiah('Rp 1.299.000')).toBe(1299000);
    expect(parseRupiah('IDR 450.000')).toBe(450000);
    expect(parseRupiah('699000')).toBe(699000);
    expect(parseRupiah(699000)).toBe(699000);
  });

  it('menganggap satu pemisah + tepat 3 digit sebagai ribuan, bukan desimal', () => {
    // Ini inti aturannya: "699.000" di IDR berarti 699 ribu, bukan 699 rupiah.
    expect(parseRupiah('699.000')).toBe(699000);
    expect(parseRupiah('699,000')).toBe(699000);
  });

  it('memakai pemisah terakhir sebagai desimal kalau titik dan koma dua-duanya ada', () => {
    expect(parseRupiah('699.000,50')).toBe(699000.5);
    expect(parseRupiah('699,000.50')).toBe(699000.5);
    expect(parseRupiah('1.299.000,00')).toBe(1299000);
  });

  it('memperlakukan satu pemisah dengan 1-2 digit di belakang sebagai desimal', () => {
    expect(parseRupiah('12,5')).toBe(12.5);
    expect(parseRupiah('12.5')).toBe(12.5);
  });

  it('membaca notasi negatif', () => {
    expect(parseRupiah('-Rp50.000')).toBe(-50000);
    expect(parseRupiah('(Rp50.000)')).toBe(-50000);
  });

  it('mengembalikan null untuk nilai yang bukan angka', () => {
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('   ')).toBeNull();
    expect(parseRupiah('-')).toBeNull();
    expect(parseRupiah('N/A')).toBeNull();
    expect(parseRupiah(null)).toBeNull();
    expect(parseRupiah(undefined)).toBeNull();
  });

  it('tahan terhadap non-breaking space dari copy-paste Excel', () => {
    expect(parseRupiah('Rp 699.000')).toBe(699000);
  });
});

describe('parseOrderDate', () => {
  it('membaca format utama file ekspor', () => {
    expect(parseOrderDate('2026-10-20 08:20')).toEqual({ dateKey: '2026-10-20', time: '08:20' });
  });

  it('membaca ISO dengan T dan Z', () => {
    expect(parseOrderDate('2026-10-20T08:20:00Z')).toEqual({ dateKey: '2026-10-20', time: '08:20' });
  });

  it('membaca dd/mm/yyyy sebagai tanggal Indonesia', () => {
    expect(parseOrderDate('03/10/2026 14:05')).toEqual({ dateKey: '2026-10-03', time: '14:05' });
  });

  it('menukar urutan kalau jelas mm/dd/yyyy', () => {
    // 10/20/2026: angka kedua 20 > 12, jadi pasti bulan di depan.
    expect(parseOrderDate('10/20/2026')).toEqual({ dateKey: '2026-10-20', time: null });
  });

  it('membaca nama bulan Indonesia dan Inggris', () => {
    expect(parseOrderDate('20 Okt 2026')?.dateKey).toBe('2026-10-20');
    expect(parseOrderDate('20 October 2026')?.dateKey).toBe('2026-10-20');
  });

  it('TIDAK bergeser satu hari apa pun timezone-nya', () => {
    // Regresi untuk bug timezone: new Date("2026-10-01") = UTC tengah malam,
    // yang di zona UTC-5 menjadi 30 September. Parser kami murni teks.
    expect(parseOrderDate('2026-10-01 00:05')?.dateKey).toBe('2026-10-01');
    expect(parseOrderDate('2026-10-01')?.dateKey).toBe('2026-10-01');
    expect(parseOrderDate('2026-10-31 23:59')?.dateKey).toBe('2026-10-31');
  });

  it('menolak tanggal yang tidak ada', () => {
    expect(parseOrderDate('2026-02-30')).toBeNull();
    expect(parseOrderDate('2026-13-01')).toBeNull();
    expect(parseOrderDate('bukan tanggal')).toBeNull();
    expect(parseOrderDate('')).toBeNull();
  });

  it('membaca serial Excel', () => {
    // 46296 = 2026-10-01, 46315 = 2026-10-20 pada basis 1900 Excel.
    // (Konstanta ini saya cek ulang dengan hitungan hari, bukan ditebak.)
    expect(parseOrderDate('46296')?.dateKey).toBe('2026-10-01');
    expect(parseOrderDate('46315')?.dateKey).toBe('2026-10-20');
    expect(parseOrderDate('46315.5')?.time).toBe('12:00');
  });
});

describe('normalizeChannel', () => {
  it('menyatukan variasi penulisan', () => {
    expect(normalizeChannel('Shopee')).toBe('Shopee');
    expect(normalizeChannel('  shopee ')).toBe('Shopee');
    expect(normalizeChannel('SHOPEE')).toBe('Shopee');
    expect(normalizeChannel('TikTok Shop')).toBe('TikTok Shop');
    expect(normalizeChannel('tiktok_shop')).toBe('TikTok Shop');
    expect(normalizeChannel('TiktokShop')).toBe('TikTok Shop');
    expect(normalizeChannel('Tokopedia')).toBe('Tokopedia');
    expect(normalizeChannel('tokped')).toBe('Tokopedia');
  });

  it('mengembalikan Unknown, bukan menebak', () => {
    expect(normalizeChannel('Lazada')).toBe('Unknown');
    expect(normalizeChannel('')).toBe('Unknown');
    expect(normalizeChannel(null)).toBe('Unknown');
  });
});

describe('classifyStatus', () => {
  it('mengenali pembatalan dalam bahasa Indonesia dan Inggris', () => {
    for (const s of ['Batal', 'Dibatalkan', 'Cancelled', 'Canceled', 'CANCEL', 'Pembatalan']) {
      expect(classifyStatus(s), s).toBe('cancelled');
    }
  });

  it('mengenali retur dan refund', () => {
    for (const s of ['Retur', 'Dikembalikan', 'Returned', 'Refunded', 'Pengembalian Dana']) {
      expect(classifyStatus(s), s).toBe('returned');
    }
  });

  it('mengenali pesanan selesai', () => {
    for (const s of ['Selesai', 'Completed', 'Delivered', 'Pesanan Selesai']) {
      expect(classifyStatus(s), s).toBe('completed');
    }
  });

  it('mengenali pesanan yang masih jalan', () => {
    for (const s of ['Dikirim', 'Dalam Pengiriman', 'Shipping', 'Perlu Dikirim', 'Diproses']) {
      expect(classifyStatus(s), s).toBe('in_progress');
    }
  });

  it('frasa gabungan diklasifikasi sebagai pembatalan, bukan pengiriman', () => {
    // "Pengiriman Dibatalkan" mengandung kata "pengiriman" DAN "dibatalkan".
    // Urutan pola harus memenangkan pembatalan, kalau tidak revenue jadi lebih besar.
    expect(classifyStatus('Pengiriman Dibatalkan')).toBe('cancelled');
    expect(classifyStatus('Dibatalkan Pembeli')).toBe('cancelled');
    expect(classifyStatus('Selesai - Dikembalikan')).toBe('returned');
  });

  it('memisahkan belum bayar dari dibatalkan', () => {
    expect(classifyStatus('Belum Bayar')).toBe('pending_payment');
    expect(classifyStatus('Menunggu Pembayaran')).toBe('pending_payment');
    expect(classifyStatus('Unpaid')).toBe('pending_payment');
  });

  it('status asing jadi unknown, tidak ditebak', () => {
    expect(classifyStatus('Entahlah')).toBe('unknown');
    expect(classifyStatus('')).toBe('unknown');
  });
});

describe('isNetRevenue', () => {
  it('menghitung selesai dan dalam pengiriman', () => {
    expect(isNetRevenue('completed', { includePendingPayment: true })).toBe(true);
    expect(isNetRevenue('in_progress', { includePendingPayment: true })).toBe(true);
  });

  it('tidak pernah menghitung batal, retur, dan unknown', () => {
    for (const flag of [true, false]) {
      expect(isNetRevenue('cancelled', { includePendingPayment: flag })).toBe(false);
      expect(isNetRevenue('returned', { includePendingPayment: flag })).toBe(false);
      expect(isNetRevenue('unknown', { includePendingPayment: flag })).toBe(false);
    }
  });

  it('belum bayar mengikuti pilihan pengguna', () => {
    expect(isNetRevenue('pending_payment', { includePendingPayment: true })).toBe(true);
    expect(isNetRevenue('pending_payment', { includePendingPayment: false })).toBe(false);
  });
});

describe('parseQty', () => {
  it('membaca angka bulat positif', () => {
    expect(parseQty('1')).toBe(1);
    expect(parseQty(' 2 ')).toBe(2);
    expect(parseQty('1.0')).toBe(1);
    expect(parseQty(3)).toBe(3);
  });

  it('menolak nol, negatif, pecahan, dan teks', () => {
    expect(parseQty('0')).toBeNull();
    expect(parseQty('-1')).toBeNull();
    expect(parseQty('1,5')).toBeNull();
    expect(parseQty('dua')).toBeNull();
    expect(parseQty('')).toBeNull();
  });
});

describe('mapHeader', () => {
  it('mencocokkan header meski beda kapital, spasi, dan bahasa', () => {
    expect(mapHeader('order_id')).toBe('order_id');
    expect(mapHeader(' Order ID ')).toBe('order_id');
    expect(mapHeader('﻿order_id')).toBe('order_id');
    expect(mapHeader('Nama Produk')).toBe('product_name');
    expect(mapHeader('Harga Satuan')).toBe('unit_price');
  });

  it('mengembalikan null untuk kolom yang tidak dikenal', () => {
    expect(mapHeader('catatan_pembeli')).toBeNull();
  });
});

describe('regresi: bug yang ditemukan saat audit lanjutan', () => {
  it('spasi yang menyelip di tengah angka tidak membuat salah baca 1000x', () => {
    // "Rp 699. 000" sempat terbaca 699 karena spasi setelah titik membuat
    // "000" tidak dikenali sebagai kelompok ribuan.
    expect(parseRupiah('Rp 699. 000')).toBe(699000);
    expect(parseRupiah('Rp 1. 299. 000')).toBe(1299000);
    expect(parseRupiah(' 699.000 ')).toBe(699000);
  });

  it('qty memakai aturan pemisah ribuan yang sama dengan kolom harga', () => {
    // Dulu '1.000' terbaca 1 di kolom qty tapi 1.000 di kolom harga.
    expect(parseQty('1.000')).toBe(1000);
    expect(parseQty('1,000')).toBe(1000);
    // Yang lama tetap harus berlaku.
    expect(parseQty('1.0')).toBe(1);
    expect(parseQty('1,5')).toBeNull();
    expect(parseQty('0')).toBeNull();
  });

  it('angka lima digit yang bukan serial tanggal ditolak, bukan jadi tahun 2173', () => {
    expect(parseOrderDate('99999')).toBeNull();
    expect(parseOrderDate('10000')).toBeNull();
    // Serial yang masuk akal tetap dibaca.
    expect(parseOrderDate('46296')?.dateKey).toBe('2026-10-01');
  });

  it('jam dari serial Excel tidak pernah menjadi 24:00', () => {
    expect(parseOrderDate('46315.99999')?.time).toBe('23:59');
  });

  it('status soal pembayaran dipisah: belum bayar vs pasti gagal bayar', () => {
    // Dua kelompok berbeda. 'Belum Bayar' masih mungkin jadi, jadi masuk bucket
    // pending_payment yang bisa di-toggle. 'Tidak Dibayar' / 'Pembayaran Gagal'
    // sudah pasti tidak jadi, jadi diperlakukan sebagai pembatalan dan TIDAK
    // pernah ikut dihitung — sekalipun toggle pending dinyalakan.
    for (const s of ['Belum Bayar', 'Belum Dibayar', 'Unpaid', 'Menunggu Pembayaran']) {
      expect(classifyStatus(s), s).toBe('pending_payment');
    }
    for (const s of ['Tidak Dibayar', 'Tidak Bayar', 'Pembayaran Gagal', 'Payment Failed']) {
      expect(classifyStatus(s), s).toBe('cancelled');
      expect(isNetRevenue(classifyStatus(s), { includePendingPayment: true }), s).toBe(false);
    }
  });
});