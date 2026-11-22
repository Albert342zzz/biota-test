/**
 * Pembersihan dan penggabungan baris mentah dari ketiga channel.
 *
 * Prinsip yang dipakai di sini:
 *  1. Baris yang bermasalah TIDAK dibuang diam-diam. Setiap keputusan dicatat
 *     sebagai `Issue` dan ditampilkan di panel "Kualitas data" di UI.
 *  2. Kalau sebuah nilai tidak bisa dipercaya, baris itu tidak ikut dihitung,
 *     bukan ditebak. Angka yang kurang tapi jujur lebih baik daripada angka
 *     yang terlihat lengkap tapi salah.
 */

import {
  cleanText,
  classifyStatus,
  normalizeChannel,
  parseOrderDate,
  parseQty,
  parseRupiah,
  productNameKey,
  type CanonicalColumn,
} from './normalize';
import type { CleanResult, Issue, OrderLine, StatusBucket } from './types';

export type RawRow = Partial<Record<CanonicalColumn, string>>;

/** Selisih maksimum (rupiah) antara total_price dan qty x unit_price yang masih kami anggap sama. */
export const TOTAL_TOLERANCE = 1;

/**
 * Kolom yang tanpa ini perhitungan tidak mungkin dilakukan.
 *
 * `sku` TIDAK termasuk: di file asli 15% baris punya sku kosong, dan nilainya
 * bisa dipulihkan dari `product_name` (lihat buildSkuLookup).
 */
const REQUIRED_COLUMNS: CanonicalColumn[] = ['order_date', 'channel', 'qty', 'status'];

/**
 * Membangun kamus nama listing -> SKU dari baris yang SKU-nya terisi.
 *
 * Di file asli, 76 dari 495 baris punya sku kosong, tapi product_name-nya
 * selalu sama dengan baris lain yang sku-nya ada. Membuang baris itu berarti
 * membuang ~15% revenue; menebaknya berarti angkanya tidak bisa dipercaya.
 * Jalan tengahnya: pulihkan HANYA kalau satu nama listing memetakan ke tepat
 * SATU sku di seluruh file. Nama yang ambigu dibiarkan kosong dan dilaporkan.
 */
export function buildSkuLookup(rawRows: RawRow[]): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const row of rawRows) {
    const sku = cleanText(row.sku).toUpperCase();
    const key = productNameKey(row.product_name);
    if (!sku || !key) continue;
    const set = candidates.get(key);
    if (set) set.add(sku);
    else candidates.set(key, new Set([sku]));
  }
  const lookup = new Map<string, string>();
  for (const [key, skus] of candidates) {
    if (skus.size === 1) lookup.set(key, [...skus][0]);
  }
  return lookup;
}

export interface CleanOptions {
  /**
   * Bila true, `total_price` dari file dipakai apa adanya walaupun berbeda dari
   * qty x unit_price. Default false — lihat README, aturan rekonsiliasi.
   */
  trustReportedTotal?: boolean;
}

/** Kunci dedupe: baris dianggap duplikat kalau SELURUH isi kolomnya identik. */
function dedupeKey(row: RawRow): string {
  return [
    cleanText(row.order_id).toUpperCase(),
    cleanText(row.order_date),
    cleanText(row.channel).toLowerCase(),
    cleanText(row.sku).toUpperCase(),
    cleanText(row.product_name).toLowerCase(),
    cleanText(row.qty),
    cleanText(row.unit_price),
    cleanText(row.total_price),
    cleanText(row.status).toLowerCase(),
    cleanText(row.buyer_city).toLowerCase(),
  ].join('\u0001');
}

export function cleanRows(
  rawRows: RawRow[],
  headers: string[],
  mappedHeaders: Array<CanonicalColumn | null>,
  options: CleanOptions = {},
): CleanResult {
  const { trustReportedTotal = false } = options;

  const issues: Issue[] = [];
  const lines: OrderLine[] = [];
  const seen = new Set<string>();

  // Pass 1: pelajari pemetaan nama listing -> sku dari baris yang lengkap.
  const skuLookup = buildSkuLookup(rawRows);

  const present = new Set(mappedHeaders.filter(Boolean) as CanonicalColumn[]);
  const missingHeaders = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  const unmappedHeaders = headers.filter((h, i) => !mappedHeaders[i] && cleanText(h) !== '');

  let duplicateRows = 0;

  rawRows.forEach((row, index) => {
    const sourceRow = index + 1;
    const orderId = cleanText(row.order_id).toUpperCase();

    // --- Duplikat persis -------------------------------------------
    const key = dedupeKey(row);
    if (seen.has(key)) {
      duplicateRows += 1;
      issues.push({
        code: 'duplicate_row',
        sourceRow,
        orderId,
        detail: 'Baris identik dengan baris sebelumnya, tidak dihitung dua kali.',
        amount: parseRupiah(row.total_price) ?? undefined,
      });
      return;
    }
    seen.add(key);

    // --- Field wajib -----------------------------------------------
    const parsedDate = parseOrderDate(row.order_date);
    if (!parsedDate) {
      issues.push({
        code: 'unparsable_date',
        sourceRow,
        orderId,
        detail: `order_date tidak bisa dibaca: "${cleanText(row.order_date)}"`,
      });
      return;
    }

    // Pass 2: pulihkan sku yang kosong dari nama listing, kalau tidak ambigu.
    let sku = cleanText(row.sku).toUpperCase();
    let skuRecovered = false;
    if (!sku) {
      const recovered = skuLookup.get(productNameKey(row.product_name));
      if (recovered) {
        sku = recovered;
        skuRecovered = true;
      } else {
        issues.push({
          code: 'missing_sku',
          sourceRow,
          orderId,
          detail: `Kolom sku kosong dan nama listing "${cleanText(
            row.product_name,
          )}" tidak bisa dicocokkan ke sku mana pun. Baris tidak dihitung.`,
          amount: parseRupiah(row.total_price) ?? undefined,
        });
        return;
      }
    }

    const qty = parseQty(row.qty);
    if (qty === null) {
      issues.push({
        code: 'invalid_qty',
        sourceRow,
        orderId,
        detail: `qty tidak valid: "${cleanText(row.qty)}"`,
      });
      return;
    }

    // --- Uang: rekonsiliasi total_price vs qty x unit_price ---------
    const unitPriceRaw = parseRupiah(row.unit_price);
    const reportedTotal = parseRupiah(row.total_price);

    if (unitPriceRaw === null && reportedTotal === null) {
      issues.push({
        code: 'unparsable_price',
        sourceRow,
        orderId,
        detail: `unit_price "${cleanText(row.unit_price)}" dan total_price "${cleanText(
          row.total_price,
        )}" dua-duanya tidak bisa dibaca.`,
      });
      return;
    }

    // Kalau unit_price hilang, turunkan dari total; kalau total hilang, hitung dari unit.
    const unitPrice = unitPriceRaw ?? (reportedTotal as number) / qty;
    const computedTotal = unitPrice * qty;

    let lineRevenue = computedTotal;
    if (reportedTotal !== null) {
      const diff = Math.abs(reportedTotal - computedTotal);
      if (diff <= TOTAL_TOLERANCE) {
        lineRevenue = reportedTotal;
      } else {
        // Dua field independen (qty, unit_price) saling cocok; total adalah satu
        // field turunan. Jadi default-nya kami percaya hasil hitungan, dan
        // selisihnya dilaporkan supaya bisa diaudit manusia.
        lineRevenue = trustReportedTotal ? reportedTotal : computedTotal;
        issues.push({
          code: 'total_mismatch',
          sourceRow,
          orderId,
          detail: `total_price ${reportedTotal.toLocaleString('id-ID')} != qty x unit_price ${computedTotal.toLocaleString(
            'id-ID',
          )} (selisih ${diff.toLocaleString('id-ID')}). Dipakai: ${lineRevenue.toLocaleString('id-ID')}.`,
          amount: diff,
        });
      }
    }

    if (skuRecovered) {
      issues.push({
        code: 'sku_recovered_from_name',
        sourceRow,
        orderId,
        detail: `sku kosong, dipulihkan menjadi ${sku} dari nama listing "${cleanText(
          row.product_name,
        )}". Baris ini DIHITUNG.`,
        amount: lineRevenue,
      });
    }

    // --- Channel ----------------------------------------------------
    const channel = normalizeChannel(row.channel);
    if (channel === 'Unknown') {
      issues.push({
        code: 'unknown_channel',
        sourceRow,
        orderId,
        detail: `channel tidak dikenali: "${cleanText(row.channel)}". Baris tetap dihitung di grup "Unknown".`,
        amount: lineRevenue,
      });
    }

    // --- Status -----------------------------------------------------
    const statusRaw = cleanText(row.status);
    const status: StatusBucket = classifyStatus(statusRaw);
    if (status === 'unknown') {
      issues.push({
        code: 'unknown_status',
        sourceRow,
        orderId,
        detail: `status tidak dikenali: "${statusRaw}". TIDAK dihitung sebagai net revenue.`,
        amount: lineRevenue,
      });
    }

    if (!orderId) {
      issues.push({
        code: 'missing_order_id',
        sourceRow,
        orderId: '(kosong)',
        detail: 'order_id kosong. Baris tetap dihitung, tapi jumlah pesanan unik jadi kurang akurat.',
        amount: lineRevenue,
      });
    }

    lines.push({
      sourceRow,
      orderId,
      dateKey: parsedDate.dateKey,
      time: parsedDate.time,
      channel,
      sku,
      productName: cleanText(row.product_name) || sku,
      qty,
      unitPrice,
      lineRevenue,
      reportedTotal,
      statusRaw,
      status,
      skuRecovered,
      buyerCity: cleanText(row.buyer_city),
    });
  });

  issues.push(...detectMixedStatusOrders(lines));
  issues.push(...detectOutlierMonths(lines));

  return {
    lines,
    issues,
    stats: {
      rawRows: rawRows.length,
      duplicateRows,
      droppedRows: rawRows.length - lines.length,
      keptRows: lines.length,
      unmappedHeaders,
      missingHeaders,
    },
  };
}

/**
 * Satu order_id bisa punya beberapa baris produk. Kalau baris-baris itu punya
 * status yang bertentangan (satu "Selesai", satu "Batal"), itu bisa berarti
 * retur sebagian — atau bisa berarti ekspornya rusak. Kami tidak menebak:
 * status tetap dihitung per baris, tapi kejadiannya dilaporkan.
 */
function detectMixedStatusOrders(lines: OrderLine[]): Issue[] {
  const byOrder = new Map<string, OrderLine[]>();
  for (const line of lines) {
    if (!line.orderId) continue;
    const list = byOrder.get(line.orderId);
    if (list) list.push(line);
    else byOrder.set(line.orderId, [line]);
  }

  const issues: Issue[] = [];
  for (const [orderId, group] of byOrder) {
    if (group.length < 2) continue;
    const buckets = new Set(group.map((l) => l.status));
    if (buckets.size < 2) continue;
    const atRisk = group
      .filter((l) => l.status === 'cancelled' || l.status === 'returned')
      .reduce((sum, l) => sum + l.lineRevenue, 0);
    issues.push({
      code: 'mixed_status_in_order',
      sourceRow: group[0].sourceRow,
      orderId,
      detail: `Pesanan ini punya ${group.length} baris dengan status berbeda (${[...buckets].join(
        ', ',
      )}). Status dihitung per baris, bukan per pesanan.`,
      amount: atRisk,
    });
  }
  return issues;
}

/**
 * File seharusnya berisi satu bulan. Baris di luar bulan dominan biasanya
 * tanda salah parse atau data nyasar — dilaporkan, tidak dibuang.
 */
function detectOutlierMonths(lines: OrderLine[]): Issue[] {
  if (lines.length === 0) return [];
  const counts = new Map<string, number>();
  for (const line of lines) {
    const month = line.dateKey.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return lines
    .filter((l) => l.dateKey.slice(0, 7) !== dominant)
    .map<Issue>((l) => ({
      code: 'date_outside_dominant_month',
      sourceRow: l.sourceRow,
      orderId: l.orderId,
      detail: `Tanggal ${l.dateKey} di luar bulan dominan file (${dominant}). Baris tetap dihitung.`,
      amount: l.lineRevenue,
    }));
}
