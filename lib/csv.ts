/** Pembacaan CSV: Papa Parse + pemetaan header ke nama kanonik. */

import Papa from 'papaparse';
import { mapHeader, type CanonicalColumn } from './normalize';
import type { RawRow } from './clean';

export interface ParsedCsv {
  rows: RawRow[];
  headers: string[];
  mappedHeaders: Array<CanonicalColumn | null>;
  /** Pesan error dari parser (delimiter aneh, baris rusak, dll). */
  parseErrors: string[];
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
  const mappedHeaders = headers.map(mapHeader);

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
