# Log Prompt

Seluruh pekerjaan dilakukan dalam **satu sesi Claude Code** (model Claude Opus 5,
`claude-opus-5`), dijalankan di Claude Code versi web/cloud.

Prompt di bawah disalin apa adanya dari sesi tersebut, berurutan, tanpa diedit
atau dirapikan — termasuk kesalahan ketik dan kalimat yang tidak lengkap.

> **Catatan:** sesi ini berjalan di Claude Code versi cloud, yang tidak memiliki
> perintah `/export`. Isi di bawah adalah salinan langsung dari kolom input
> percakapan. Transkrip lengkap beserta seluruh keluaran tool bisa dibuka di:
>
> https://claude.ai/code/session_013HNnfmK4ShZhayrjMGL9bo

---

## Prompt 1

```
@AI-Native_Software_Engineer___Tes_Take-Home.pdf Untuk csvnya terdiri dari kolom dan contoh isi:

* order_id	order_date	channel	sku	product_name	qty	unit_price	total_price	status	buyer_city
* SHP250902015	2026-10-20 08:20	Shopee	BIO-CAM-OPZ	BIOTA Smart Camera Outdoor PTZ - CCTV Outdoor Waterproof	1	Rp699.000	Rp699.000	Batal	Bandung
```

## Prompt 2

```
Clone repositori Albert342zzz/biota-test ke sesi ini.
```

## Prompt 3

```
@biota_orders_oct2026_-_biota_orders_oct2026.csv.csv ini csvnya
```

---

## Catatan tentang cara kerja sesi ini

Jumlah prompt-nya sedikit karena Claude Code bekerja secara agentik: satu prompt
memicu banyak langkah (menjalankan perintah, membaca file, menulis kode,
menjalankan test, membuka browser) tanpa perlu prompt terpisah untuk tiap
langkah. Jadi yang lebih menggambarkan cara berpikir di sini bukan jumlah
promptnya, melainkan **urutan langkah dan keputusan** di dalam sesi, yang bisa
dilihat lengkap di tautan transkrip di atas.

Ringkasan urutan langkahnya:

1. Membaca brief dari PDF.
2. **Menyatakan risiko lebih dulu:** CSV asli belum ada, padahal kriteria
   penilaian nomor satu adalah angka yang benar. Diputuskan membangun parser
   defensif + test suite dulu, dan menunda angka final sampai data asli masuk.
3. Menulis logika pembersihan sebagai fungsi murni di `lib/`, terpisah dari
   React, supaya bisa dipakai bersama oleh UI dan CLI verifier.
4. Menulis 52 test sebelum ada UI sama sekali.
5. Satu test gagal — konstanta serial Excel. Dihitung ulang secara terpisah untuk
   menentukan siapa yang salah (ternyata test-nya), baru diperbaiki.
6. Membuat generator CSV sintetis supaya aplikasinya bisa dicoba tanpa data asli.
7. **CSV asli masuk.** Langkah pertama bukan menjalankan kode, melainkan
   profiling: menghitung nilai unik tiap kolom dan pola format tiap field.
   Dari situ ketahuan dua bug (SKU kosong 15%, format tanggal `Oct 7, 2026`).
8. Memperbaiki keduanya, menambah test untuk kasus yang benar-benar ada di file.
9. Dua test lama gagal karena perubahan perilaku; diperiksa satu per satu untuk
   memastikan test-nya yang harus berubah, bukan kodenya.
10. Menjalankan CLI verifier → angka keluar, pemeriksaan silang lolos.
11. **Tidak langsung percaya.** Menulis ulang seluruh perhitungan dari nol dengan
    Python sebagai pembanding independen. Hasilnya sama persis.
12. Membangun UI, lalu menjalankannya di browser sungguhan lewat Playwright dan
    mencocokkan angka di layar dengan keluaran CLI. Cocok.
13. Menemukan masalah keterbacaan: kolom "Pesanan" tidak bisa dijumlahkan.
    Ditambahkan catatan untuk pembaca non-teknis.
14. Menulis README. **Draf pertama bagian "tiga kesalahan AI" mengarang dua dari
    tiga kejadian** — menarasikan bug timezone dan urutan status sebagai
    kesalahan yang ditemukan, padahal keduanya dicegah sejak awal lewat desain.
    Ini ditarik dan ditulis ulang hanya dengan kesalahan yang betul-betul terjadi,
    dengan dampak rupiahnya diukur lewat skrip yang bisa dijalankan ulang.
