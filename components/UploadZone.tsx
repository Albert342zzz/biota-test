'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Area unggah CSV.
 *
 * Dua tampilan dari satu komponen:
 *  - `compact` false: kotak seret-dan-lepas besar, dipakai saat belum ada data.
 *  - `compact` true : satu baris tombol di pojok kanan atas, dipakai setelah
 *    data masuk supaya tidak lagi memakan ruang utama dashboard.
 *
 * Seret-dan-lepas tetap aktif pada kedua tampilan.
 */
export function UploadZone({
  onFile,
  onSample,
  busy,
  fileName,
  compact = false,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  busy: boolean;
  fileName: string | null;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = ''; // supaya file yang sama bisa diunggah ulang
      }}
    />
  );

  if (compact) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="dropzone flex flex-wrap items-center justify-end gap-2 rounded-lg px-2 py-1.5"
        style={{
          boxShadow: dragging ? '0 0 0 2px var(--series-1)' : 'none',
          background: dragging ? 'color-mix(in oklab, var(--series-1) 8%, transparent)' : 'transparent',
        }}
      >
        {input}
        {fileName && (
          <span
            className="hidden max-w-[16rem] truncate text-xs sm:inline"
            style={{ color: 'var(--text-secondary)' }}
            title={fileName}
          >
            {fileName}
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn btn-primary px-3 py-1.5 text-xs"
        >
          {busy ? 'Memproses…' : 'Ganti CSV'}
        </button>
        <button
          type="button"
          onClick={onSample}
          disabled={busy}
          className="btn btn-ghost px-3 py-1.5 text-xs"
        >
          Data contoh
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="dropzone rounded-xl p-8 text-center"
      style={{
        background: dragging
          ? 'color-mix(in oklab, var(--series-1) 6%, var(--surface-1))'
          : 'var(--surface-1)',
        boxShadow: dragging ? '0 0 0 2px var(--series-1)' : '0 0 0 1px var(--ring)',
      }}
    >
      {input}
      <p className="text-sm font-medium">
        {fileName ? `File aktif: ${fileName}` : 'Tarik file CSV ekspor marketplace ke sini'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs" style={{ color: 'var(--text-secondary)' }}>
        Shopee, TikTok Shop dan Tokopedia bisa digabung dalam satu file. Data diproses di browser
        kamu dan tidak dikirim ke server mana pun.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn btn-primary px-4 py-2 text-sm"
        >
          {busy ? 'Memproses…' : 'Pilih file CSV'}
        </button>
        <button
          type="button"
          onClick={onSample}
          disabled={busy}
          className="btn btn-ghost px-4 py-2 text-sm"
        >
          Pakai data contoh
        </button>
      </div>
    </div>
  );
}
