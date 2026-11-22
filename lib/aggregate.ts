/**
 * Agregasi angka bisnis dari baris yang sudah bersih.
 *
 * Semua fungsi pure. Rentang tanggal dibandingkan sebagai string "YYYY-MM-DD"
 * sehingga tidak ada risiko pergeseran timezone (lihat catatan di normalize.ts).
 */

import { isNetRevenue } from './normalize';
import { CHANNELS, type Aggregates, type Channel, type ChannelAgg, type OrderLine, type ProductAgg, type Totals } from './types';

export interface AggregateOptions {
  /** Batas bawah inklusif, "YYYY-MM-DD". null = tanpa batas. */
  from?: string | null;
  /** Batas atas INKLUSIF, "YYYY-MM-DD". null = tanpa batas. */
  to?: string | null;
  /**
   * Ikut menghitung pesanan yang belum dibayar.
   * Default true karena brief hanya mengecualikan "dibatalkan" dan "diretur".
   */
  includePendingPayment?: boolean;
  /** Berapa produk teratas yang dikembalikan di `topProducts`. */
  topN?: number;
}

/**
 * Filter rentang tanggal, kedua ujungnya INKLUSIF.
 *
 * "1-15 Oktober" berarti from=2026-10-01, to=2026-10-15, dan pesanan pada
 * 15 Oktober 23:59 TETAP ikut. Ini sumber off-by-one yang paling sering.
 */
export function filterByDateRange(
  lines: OrderLine[],
  from?: string | null,
  to?: string | null,
): OrderLine[] {
  if (!from && !to) return lines;
  return lines.filter((line) => {
    if (from && line.dateKey < from) return false;
    if (to && line.dateKey > to) return false;
    return true;
  });
}

/** Rentang tanggal yang ada di data, untuk nilai awal filter. */
export function dateBounds(lines: OrderLine[]): { min: string; max: string } | null {
  if (lines.length === 0) return null;
  let min = lines[0].dateKey;
  let max = lines[0].dateKey;
  for (const line of lines) {
    if (line.dateKey < min) min = line.dateKey;
    if (line.dateKey > max) max = line.dateKey;
  }
  return { min, max };
}

function emptyExcluded(): Totals['excluded'] {
  return { pending_payment: 0, cancelled: 0, returned: 0, unknown: 0 };
}

export function aggregate(lines: OrderLine[], options: AggregateOptions = {}): Aggregates {
  const { from = null, to = null, includePendingPayment = true, topN = 10 } = options;

  const scoped = filterByDateRange(lines, from, to);
  const netOpts = { includePendingPayment };

  const totals: Totals = {
    netRevenue: 0,
    units: 0,
    orders: 0,
    excluded: emptyExcluded(),
    grossRevenue: 0,
  };

  const netOrderIds = new Set<string>();
  const channelMap = new Map<Channel, { netRevenue: number; units: number; orders: Set<string> }>();
  const productMap = new Map<
    string,
    {
      netRevenue: number;
      units: number;
      orders: Set<string>;
      channels: Set<Channel>;
      /** nama listing -> berapa kali muncul, untuk memilih nama yang paling umum */
      names: Map<string, number>;
    }
  >();

  for (const line of scoped) {
    totals.grossRevenue += line.lineRevenue;

    if (!isNetRevenue(line.status, netOpts)) {
      // Semua bucket yang tidak dihitung masuk ke rincian pengecualian.
      const bucket = line.status as keyof Totals['excluded'];
      if (bucket in totals.excluded) totals.excluded[bucket] += line.lineRevenue;
      continue;
    }

    totals.netRevenue += line.lineRevenue;
    totals.units += line.qty;
    if (line.orderId) netOrderIds.add(line.orderId);

    const ch = channelMap.get(line.channel) ?? { netRevenue: 0, units: 0, orders: new Set<string>() };
    ch.netRevenue += line.lineRevenue;
    ch.units += line.qty;
    if (line.orderId) ch.orders.add(line.orderId);
    channelMap.set(line.channel, ch);

    const p =
      productMap.get(line.sku) ??
      { netRevenue: 0, units: 0, orders: new Set<string>(), channels: new Set<Channel>(), names: new Map<string, number>() };
    p.netRevenue += line.lineRevenue;
    p.units += line.qty;
    if (line.orderId) p.orders.add(line.orderId);
    p.channels.add(line.channel);
    p.names.set(line.productName, (p.names.get(line.productName) ?? 0) + 1);
    productMap.set(line.sku, p);
  }

  totals.orders = netOrderIds.size;

  // Channel selalu ditampilkan lengkap (termasuk yang nol) agar grafik stabil
  // saat difilter; "Unknown" hanya muncul kalau memang ada.
  const channelOrder: Channel[] = [...CHANNELS, 'Unknown'];
  const byChannel: ChannelAgg[] = channelOrder
    .filter((c) => c !== 'Unknown' || channelMap.has('Unknown'))
    .map((channel) => {
      const agg = channelMap.get(channel);
      return {
        channel,
        netRevenue: agg?.netRevenue ?? 0,
        units: agg?.units ?? 0,
        orders: agg?.orders.size ?? 0,
      };
    })
    .sort((a, b) => b.netRevenue - a.netRevenue);

  const byProduct: ProductAgg[] = [...productMap.entries()]
    .map(([sku, p]) => {
      const names = [...p.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return {
        sku,
        productName: names[0][0],
        aliases: names.slice(1).map(([name]) => name),
        netRevenue: p.netRevenue,
        units: p.units,
        orders: p.orders.size,
        channels: [...p.channels],
      };
    })
    // Tie-break pakai SKU supaya urutannya deterministik (penting untuk test).
    .sort((a, b) => b.netRevenue - a.netRevenue || a.sku.localeCompare(b.sku));

  return { totals, byChannel, byProduct, topProducts: byProduct.slice(0, topN) };
}
