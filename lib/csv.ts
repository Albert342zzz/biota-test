/** Pembacaan CSV: Papa Parse + pemetaan header ke nama kanonik. */

import Papa from 'papaparse';
import { mapHeader, slugifyHeader, type CanonicalColumn } from './normalize';
import type { RawRow } from './clean';

export interface ParsedCsv {
  rows: RawRow[];
  headers: string[];
  mappedHeaders: Array<CanonicalColumn | null>;
  /** Pesan error dari parser (delimiter aneh, baris rusak, dll). */
  parseErrors: string[];
}

/**
 * Memetakan header ke nama kanonik, dan menyelesaikan tabrakan.
 *
 * Satu file bisa punya dua kolom yang sama-sama berarti `total_price` — mis.
 * `total` dan `total_price`. Sebelumnya kolom yang belakangan diam-diam
 * menimpa yang duluan, jadi nilai yang dipakai tergantung urutan kolom di file.
 *
 * Aturannya sekarang: yang menang adalah kolom yang namanya PERSIS sama dengan
 * nama kanonik; kalau tidak ada, yang pertama muncul. Kolom kembar lainnya
 * dilepas pemetaannya sehingga muncul di daftar "kolom tidak dipakai" di panel
 * kualitas data — terlihat, bukan diam-diam dibuang.
 */
export function resolveHeaderCollisions(headers: string[]): Array<CanonicalColumn | null> {
  const mapped = headers.map(mapHeader);
  const byColumn = new Map<CanonicalColumn, number[]>();
  mapped.forEach((col, i) => {
    if (!col) return;
    const list = byColumn.get(col);
    if (list) list.push(i);
    else byColumn.set(col, [i]);
  });

  for (const [col, indexes] of byColumn) {
    if (indexes.length < 2) continue;
    const exact = indexes.find((i) => slugifyHeader(headers[i]) === col);
    const winner = exact ?? indexes[0];
    for (const i of indexes) if (i !== winner) mapped[i] = null;
  }
  return mapped;
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
    // delimiter dibiarkan auto-detect: ekspor Excel versi Indonesia kadang pakai ';'
  });

  const rowsRaw = (result.data ?? []).filter((r) => Array.isArray(r) && r.some((c) => (c ?? '').trim() !== ''));
  if (rowsRaw.length === 0) {
    return { rows: [], headers: [], mappedHeaders: [], parseErrors: ['File kosong atau tidak ada baris yang bisa dibaca.'] };
  }

  const headers = rowsRaw[0].map((h) => (h ?? '').toString());
  const mappedHeaders = resolveHeaderCollisions(headers);

  const rows: RawRow[] = rowsRaw.slice(1).map((cells) => {
    const row: RawRow = {};
    mappedHeaders.forEach((col, i) => {
      if (col) row[col] = (cells[i] ?? '').toString();
    });
    return row;
  });

  const parseErrors = (result.errors ?? [])
    .filter((e) => e.code !== 'TooFewFields' && e.code !== 'TooManyFields')
    .slice(0, 10)
    .map((e) => `Baris ${(e.row ?? 0) + 1}: ${e.message}`);

  return { rows, headers, mappedHeaders, parseErrors };
}
