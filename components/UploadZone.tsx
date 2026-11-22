'use client';

import { useCallback, useRef, useState } from 'react';

export function UploadZone({
  onFile,
  onSample,
  busy,
  fileName,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  busy: boolean;
  fileName: string | null;
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

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="rounded-xl p-6 text-center transition-colors"
      style={{
        background: 'var(--surface-1)',
        boxShadow: dragging ? '0 0 0 2px var(--series-1)' : '0 0 0 1px var(--ring)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ''; // supaya file yang sama bisa diupload ulang
        }}
      />
      <p className="text-sm font-medium">
        {fileName ? `File aktif: ${fileName}` : 'Tarik file CSV ekspor marketplace ke sini'}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Shopee, TikTok Shop dan Tokopedia bisa digabung dalam satu file. Data diproses di browser
        kamu dan tidak dikirim ke server mana pun.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--series-1)' }}
        >
          {busy ? 'Memproses…' : 'Pilih file CSV'}
        </button>
        <button
          type="button"
          onClick={onSample}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ boxShadow: '0 0 0 1px var(--baseline)', color: 'var(--text-secondary)' }}
        >
          Pakai data contoh
        </button>
      </div>
    </div>
  );
}
