# Tools dan model AI yang dipakai

| Tool | Nama dan versi model AI | Dipakai untuk |
|---|---|---|
| Claude Code (CLI, sesi cloud) | Claude Opus 5 (`claude-opus-5`) | Seluruh pekerjaan: logika pembersihan data, test, komponen UI, CLI verifier, dan README |
| Playwright (dijalankan dari Claude Code) | — | Menjalankan dashboard di Chromium sungguhan, mengupload CSV asli, dan mencocokkan angka di layar dengan keluaran CLI |
| Python 3 (dijalankan dari Claude Code) | — | Profiling kolom CSV asli, dan menulis ulang seluruh perhitungan dari nol sebagai pembanding independen |

Tidak ada tool AI lain yang dipakai. Tidak ada ChatGPT, Copilot, atau Cursor.

Log prompt lengkap ada di [`PROMPT_LOG.md`](PROMPT_LOG.md).
