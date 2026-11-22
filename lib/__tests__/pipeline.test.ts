import { describe, expect, it } from 'vitest';
import { parseCsvText } from '../csv';
import { cleanRows } from '../clean';
import { aggregate, filterByDateRange } from '../aggregate';

/** Helper: CSV mentah -> hasil bersih, meniru jalur yang dipakai UI. */
function run(csv: string, opts?: Parameters<typeof cleanRows>[3]) {
  const parsed = parseCsvText(csv);
  return cleanRows(parsed.rows, parsed.headers, parsed.mappedHeaders, opts);
}

const HEADER =
  'order_id,order_date,channel,sku,product_name,qty,unit_price,total_price,status,buyer_city';

describe('pipeline: status menentukan net revenue', () => {
  const csv = [
    HEADER,
    'SHP001,2026-10-02 08:20,Shopee,BIO-CAM-OPZ,Smart Camera,1,Rp699.000,Rp699.000,Selesai,Bandung',
    'SHP002,2026-10-03 09:00,Shopee,BIO-CAM-OPZ,Smart Camera,1,Rp699.000,Rp699.000,Dikirim,Jakarta',
    'SHP003,2026-10-04 09:00,Shopee,BIO-CAM-OPZ,Smart Camera,1,Rp699.000,Rp699.000,Batal,Medan',
    'TTS004,2026-10-05 09:00,TikTok Shop,BIO-CAM-OPZ,Kamera CCTV,1,Rp699.000,Rp699.000,Retur,Surabaya',
    'TKP005,2026-10-06 09:00,Tokopedia,BIO-CAM-OPZ,Smart Camera,1,Rp699.000,Rp699.000,Belum Bayar,Depok',
  ].join('\n');

  it('hanya menghitung selesai + dalam pengiriman + belum bayar (default brief)', () => {
    const { lines } = run(csv);
    const agg = aggregate(lines, { includePendingPayment: true });
    // 699k (selesai) + 699k (dikirim) + 699k (belum bayar)
    expect(agg.totals.netRevenue).toBe(2_097_000);
    expect(agg.totals.excluded.cancelled).toBe(699_000);
    expect(agg.totals.excluded.returned).toBe(699_000);
  });

  it('mengeluarkan pesanan belum bayar kalau opsinya dimatikan', () => {
    const { lines } = run(csv);
    const agg = aggregate(lines, { includePendingPayment: false });
    expect(agg.totals.netRevenue).toBe(1_398_000);
    expect(agg.totals.excluded.pending_payment).toBe(699_000);
  });

  it('gross revenue tetap menjumlahkan semuanya', () => {
    const { lines } = run(csv);
    const agg = aggregate(lines);
    expect(agg.totals.grossRevenue).toBe(3_495_000);
  });
});

describe('pipeline: rentang tanggal inklusif di kedua ujung', () => {
  const csv = [
    HEADER,
    'A1,2026-09-30 23:59,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
    'A2,2026-10-01 00:01,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
    'A3,2026-10-15 23:59,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
    'A4,2026-10-16 00:01,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
  ].join('\n');

  it('1-15 Oktober mencakup 1 Okt dini hari dan 15 Okt tengah malam', () => {
    const { lines } = run(csv);
    const scoped = filterByDateRange(lines, '2026-10-01', '2026-10-15');
    expect(scoped.map((l) => l.orderId)).toEqual(['A2', 'A3']);
    expect(aggregate(lines, { from: '2026-10-01', to: '2026-10-15' }).totals.netRevenue).toBe(200_000);
  });

  it('tanpa filter, semuanya ikut', () => {
    const { lines } = run(csv);
    expect(aggregate(lines).totals.netRevenue).toBe(400_000);
  });
});

describe('pipeline: rekonsiliasi total_price', () => {
  it('memakai hasil hitungan dan melaporkan selisih kalau total tidak cocok', () => {
    const csv = [
      HEADER,
      // 2 x 350.000 = 700.000, tapi file menulis 350.000 (lupa dikali qty).
      'B1,2026-10-02 08:00,Shopee,S1,P,2,Rp350.000,Rp350.000,Selesai,X',
    ].join('\n');
    const { lines, issues } = run(csv);
    expect(lines[0].lineRevenue).toBe(700_000);
    expect(issues.filter((i) => i.code === 'total_mismatch')).toHaveLength(1);
  });

  it('bisa dipaksa mempercayai total dari file', () => {
    const csv = [
      HEADER,
      'B1,2026-10-02 08:00,Shopee,S1,P,2,Rp350.000,Rp350.000,Selesai,X',
    ].join('\n');
    const { lines } = run(csv, { trustReportedTotal: true });
    expect(lines[0].lineRevenue).toBe(350_000);
  });

  it('menurunkan unit_price dari total kalau unit_price kosong', () => {
    const csv = [HEADER, 'B2,2026-10-02 08:00,Shopee,S1,P,2,,Rp700.000,Selesai,X'].join('\n');
    const { lines } = run(csv);
    expect(lines[0].unitPrice).toBe(350_000);
    expect(lines[0].lineRevenue).toBe(700_000);
  });

  it('menghitung total dari unit_price kalau total kosong', () => {
    const csv = [HEADER, 'B3,2026-10-02 08:00,Shopee,S1,P,3,Rp100.000,,Selesai,X'].join('\n');
    const { lines } = run(csv);
    expect(lines[0].lineRevenue).toBe(300_000);
  });
});

describe('pipeline: duplikat dan baris rusak', () => {
  it('membuang baris yang identik seluruhnya, sekali saja', () => {
    const row = 'C1,2026-10-02 08:00,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X';
    const { lines, issues, stats } = run([HEADER, row, row, row].join('\n'));
    expect(lines).toHaveLength(1);
    expect(stats.duplicateRows).toBe(2);
    expect(issues.filter((i) => i.code === 'duplicate_row')).toHaveLength(2);
  });

  it('TIDAK membuang dua baris SKU sama dalam satu order kalau isinya berbeda', () => {
    const csv = [
      HEADER,
      'C2,2026-10-02 08:00,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
      'C2,2026-10-02 08:00,Shopee,S1,P,2,Rp100.000,Rp200.000,Selesai,X',
    ].join('\n');
    const { lines } = run(csv);
    expect(lines).toHaveLength(2);
    expect(aggregate(lines).totals.netRevenue).toBe(300_000);
  });

  it('melewati baris dengan tanggal, sku, atau qty yang tidak valid', () => {
    const csv = [
      HEADER,
      'D1,bukan-tanggal,Shopee,S1,Produk Satu,1,Rp100.000,Rp100.000,Selesai,X',
      // sku kosong DAN nama listingnya tidak dipakai baris lain -> tidak bisa dipulihkan.
      'D2,2026-10-02 08:00,Shopee,,Produk Tanpa Padanan,1,Rp100.000,Rp100.000,Selesai,X',
      'D3,2026-10-02 08:00,Shopee,S1,Produk Satu,0,Rp100.000,Rp100.000,Selesai,X',
      'D4,2026-10-02 08:00,Shopee,S1,Produk Satu,1,Rp100.000,Rp100.000,Selesai,X',
    ].join('\n');
    const { lines, issues, stats } = run(csv);
    expect(lines.map((l) => l.orderId)).toEqual(['D4']);
    expect(stats.droppedRows).toBe(3);
    expect(issues.map((i) => i.code).sort()).toEqual(
      ['invalid_qty', 'missing_sku', 'unparsable_date'].sort(),
    );
  });
});

describe('pipeline: produk diagregasi per SKU, bukan per nama listing', () => {
  it('menggabungkan nama listing berbeda untuk SKU yang sama', () => {
    const csv = [
      HEADER,
      'E1,2026-10-02 08:00,Shopee,BIO-CAM-OPZ,BIOTA Smart Camera Outdoor PTZ,1,Rp700.000,Rp700.000,Selesai,X',
      'E2,2026-10-03 08:00,TikTok Shop,bio-cam-opz,CCTV Outdoor Waterproof PTZ Murah,2,Rp700.000,Rp1.400.000,Selesai,X',
      'E3,2026-10-04 08:00,Tokopedia,BIO-CAM-OPZ ,BIOTA Smart Camera Outdoor PTZ,1,Rp700.000,Rp700.000,Selesai,X',
    ].join('\n');
    const { lines } = run(csv);
    const agg = aggregate(lines);
    expect(agg.byProduct).toHaveLength(1);
    expect(agg.byProduct[0].sku).toBe('BIO-CAM-OPZ');
    expect(agg.byProduct[0].units).toBe(4);
    expect(agg.byProduct[0].netRevenue).toBe(2_800_000);
    // Nama yang dipakai adalah yang paling sering muncul.
    expect(agg.byProduct[0].productName).toBe('BIOTA Smart Camera Outdoor PTZ');
    expect(agg.byProduct[0].aliases).toContain('CCTV Outdoor Waterproof PTZ Murah');
    expect(agg.byProduct[0].channels.sort()).toEqual(['Shopee', 'TikTok Shop', 'Tokopedia']);
  });
});

describe('pipeline: hitungan pesanan unik', () => {
  it('satu pesanan dengan beberapa baris tetap dihitung satu pesanan', () => {
    const csv = [
      HEADER,
      'F1,2026-10-02 08:00,Shopee,S1,P1,1,Rp100.000,Rp100.000,Selesai,X',
      'F1,2026-10-02 08:00,Shopee,S2,P2,1,Rp200.000,Rp200.000,Selesai,X',
      'F2,2026-10-03 08:00,Shopee,S1,P1,1,Rp100.000,Rp100.000,Selesai,X',
    ].join('\n');
    const agg = aggregate(run(csv).lines);
    expect(agg.totals.orders).toBe(2);
    expect(agg.totals.units).toBe(3);
    expect(agg.totals.netRevenue).toBe(400_000);
  });
});

describe('pipeline: masalah data dilaporkan, tidak disembunyikan', () => {
  it('status tak dikenal tidak masuk net revenue dan dicatat', () => {
    const csv = [
      HEADER,
      'G1,2026-10-02 08:00,Shopee,S1,P,1,Rp100.000,Rp100.000,Status Aneh,X',
      'G2,2026-10-02 08:00,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
    ].join('\n');
    const { lines, issues } = run(csv);
    expect(aggregate(lines).totals.netRevenue).toBe(100_000);
    expect(aggregate(lines).totals.excluded.unknown).toBe(100_000);
    expect(issues.some((i) => i.code === 'unknown_status')).toBe(true);
  });

  it('channel tak dikenal tetap dihitung tapi dipisah dan dilaporkan', () => {
    const csv = [
      HEADER,
      'H1,2026-10-02 08:00,Lazada,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
    ].join('\n');
    const { lines, issues } = run(csv);
    const agg = aggregate(lines);
    expect(agg.byChannel.find((c) => c.channel === 'Unknown')?.netRevenue).toBe(100_000);
    expect(issues.some((i) => i.code === 'unknown_channel')).toBe(true);
  });

  it('status campur dalam satu pesanan dilaporkan', () => {
    const csv = [
      HEADER,
      'I1,2026-10-02 08:00,Shopee,S1,P1,1,Rp100.000,Rp100.000,Selesai,X',
      'I1,2026-10-02 08:00,Shopee,S2,P2,1,Rp200.000,Rp200.000,Retur,X',
    ].join('\n');
    const { issues } = run(csv);
    const mixed = issues.find((i) => i.code === 'mixed_status_in_order');
    expect(mixed?.orderId).toBe('I1');
    expect(mixed?.amount).toBe(200_000);
  });

  it('melaporkan kolom yang tidak dikenali dan kolom wajib yang hilang', () => {
    const csv = ['order_id,order_date,catatan_kurir', 'J1,2026-10-02 08:00,titip tetangga'].join('\n');
    const { stats } = run(csv);
    expect(stats.unmappedHeaders).toEqual(['catatan_kurir']);
    // `sku` tidak ada di daftar wajib karena bisa dipulihkan dari product_name.
    expect(stats.missingHeaders).toEqual(['channel', 'qty', 'status']);
  });
});

describe('pipeline: toleran terhadap bentuk file', () => {
  it('menerima header beda kapital/bahasa dan delimiter titik koma', () => {
    const csv = [
      'Order ID;Tanggal;Marketplace;SKU;Nama Produk;Jumlah;Harga Satuan;Total;Status Pesanan;Kota',
      'K1;03/10/2026 10:00;tokped;S1;Produk A;2;Rp50.000;Rp100.000;Pesanan Selesai;Bekasi',
    ].join('\n');
    const { lines } = run(csv);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      channel: 'Tokopedia',
      dateKey: '2026-10-03',
      qty: 2,
      lineRevenue: 100_000,
      status: 'completed',
    });
  });

  it('menerima BOM di awal file', () => {
    const csv = ['﻿' + HEADER, 'L1,2026-10-02 08:00,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X'].join('\n');
    expect(run(csv).lines).toHaveLength(1);
  });
});

describe('pipeline: top produk', () => {
  it('mengurutkan menurun dan membatasi jumlahnya secara deterministik', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      `M${i},2026-10-02 08:00,Shopee,SKU-${String(i).padStart(2, '0')},P${i},1,Rp${(i + 1) * 10}.000,Rp${(i + 1) * 10}.000,Selesai,X`,
    );
    const agg = aggregate(run([HEADER, ...rows].join('\n')).lines, { topN: 10 });
    expect(agg.topProducts).toHaveLength(10);
    expect(agg.topProducts[0].sku).toBe('SKU-11');
    const revenues = agg.topProducts.map((p) => p.netRevenue);
    expect([...revenues].sort((a, b) => b - a)).toEqual(revenues);
  });
});

describe('pipeline: pemulihan sku kosong dari nama listing', () => {
  it('memulihkan sku kosong kalau nama listing memetakan ke tepat satu sku', () => {
    const csv = [
      HEADER,
      'N1,2026-10-02 08:00,Shopee,BIO-SD-V128,MicroSD V-GeN Turbo 128GB,1,Rp159.000,Rp159.000,Selesai,X',
      'N2,2026-10-03 08:00,Shopee,,MicroSD V-GeN Turbo 128GB,3,Rp159.000,Rp477.000,Selesai,X',
    ].join('\n');
    const { lines, issues } = run(csv);
    expect(lines).toHaveLength(2);
    expect(lines[1].sku).toBe('BIO-SD-V128');
    expect(lines[1].skuRecovered).toBe(true);
    expect(issues.some((i) => i.code === 'sku_recovered_from_name')).toBe(true);
    // Revenue baris yang dipulihkan ikut terhitung.
    expect(aggregate(lines).totals.netRevenue).toBe(636_000);
  });

  it('mencocokkan nama walau beda kapital, spasi, dan tanda baca', () => {
    const csv = [
      HEADER,
      'N3,2026-10-02 08:00,Shopee,BIO-SD-V128,VGEN MicroSD 128 GB,1,Rp159.000,Rp159.000,Selesai,X',
      'N4,2026-10-03 08:00,Shopee,,  vgen microsd  128gb ,1,Rp159.000,Rp159.000,Selesai,X',
    ].join('\n');
    const { lines } = run(csv);
    expect(lines[1].sku).toBe('BIO-SD-V128');
  });

  it('TIDAK memulihkan kalau satu nama listing dipakai dua sku berbeda', () => {
    const csv = [
      HEADER,
      'N5,2026-10-02 08:00,Shopee,SKU-A,Paket Hemat,1,Rp100.000,Rp100.000,Selesai,X',
      'N6,2026-10-02 08:00,Shopee,SKU-B,Paket Hemat,1,Rp100.000,Rp100.000,Selesai,X',
      'N7,2026-10-03 08:00,Shopee,,Paket Hemat,1,Rp100.000,Rp100.000,Selesai,X',
    ].join('\n');
    const { lines, issues } = run(csv);
    expect(lines).toHaveLength(2);
    expect(issues.some((i) => i.code === 'missing_sku')).toBe(true);
  });

  it('melewati baris yang sku dan nama listing dua-duanya kosong', () => {
    const csv = [HEADER, 'N8,2026-10-02 08:00,Shopee,,,1,Rp100.000,Rp100.000,Selesai,X'].join('\n');
    expect(run(csv).lines).toHaveLength(0);
  });
});

describe('pipeline: format tanggal di file asli', () => {
  it('membaca ketiga format yang muncul di ekspor', () => {
    const csv = [
      HEADER,
      'P1,2026-10-21 08:24,Shopee,S1,P,1,Rp100.000,Rp100.000,Selesai,X',
      'P2,14/10/2026 23:26:00,TikTok Shop,S1,P,1,"100,000","100,000",Completed,X',
      'P3,"Oct 7, 2026",Tokopedia,S1,P,1,100000,100000,Pesanan Selesai,X',
    ].join('\n');
    const { lines } = run(csv);
    expect(lines.map((l) => l.dateKey)).toEqual(['2026-10-21', '2026-10-14', '2026-10-07']);
    expect(lines.map((l) => l.lineRevenue)).toEqual([100_000, 100_000, 100_000]);
  });

  it('membaca status yang ada di file asli', () => {
    const cases: Array<[string, string]> = [
      ['Selesai', 'completed'],
      ['Completed', 'completed'],
      ['Pesanan Selesai', 'completed'],
      ['Dikirim', 'in_progress'],
      ['Sedang Dikirim', 'in_progress'],
      ['In transit', 'in_progress'],
      ['Batal', 'cancelled'],
      ['Cancelled', 'cancelled'],
      ['Dibatalkan', 'cancelled'],
      ['Pengembalian Dana', 'returned'],
      ['Refunded', 'returned'],
      ['Dikomplain - Retur', 'returned'],
    ];
    for (const [raw, expected] of cases) {
      const csv = [HEADER, `Q1,2026-10-02 08:00,Shopee,S1,P,1,Rp1.000,Rp1.000,${raw},X`].join('\n');
      expect(run(csv).lines[0]?.status, raw).toBe(expected);
    }
  });
});
