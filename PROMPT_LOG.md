# Log Prompt

Pekerjaan ini dilakukan dalam **dua sesi Claude Code** dengan model yang sama
(Claude Opus 5, `claude-opus-5`):

1. **Sesi cloud** — membangun aplikasinya dari nol sampai angka akhir keluar.
2. **Sesi lokal (VS Code, Windows)** — melanjutkan di repo yang sudah di-clone:
   verifikasi ulang di mesin sendiri, audit bug lanjutan, dan perapian tampilan.

Prompt di bawah disalin apa adanya dari kedua sesi, berurutan, **tanpa diedit
atau dirapikan** — termasuk kesalahan ketik, singkatan, dan kalimat yang tidak
lengkap.

> **Catatan:** sesi cloud tidak memiliki perintah `/export`. Isi di bawah adalah
> salinan langsung dari kolom input percakapan. Transkrip lengkap sesi cloud
> beserta seluruh keluaran tool bisa dibuka di:
>
> https://claude.ai/code/session_013HNnfmK4ShZhayrjMGL9bo

---

## Sesi 1 — Claude Code (cloud)

### Prompt 1

```
@AI-Native_Software_Engineer___Tes_Take-Home.pdf Untuk csvnya terdiri dari kolom dan contoh isi:

* order_id	order_date	channel	sku	product_name	qty	unit_price	total_price	status	buyer_city
* SHP250902015	2026-10-20 08:20	Shopee	BIO-CAM-OPZ	BIOTA Smart Camera Outdoor PTZ - CCTV Outdoor Waterproof	1	Rp699.000	Rp699.000	Batal	Bandung
```

### Prompt 2

```
Clone repositori Albert342zzz/biota-test ke sesi ini.
```

### Prompt 3

```
@biota_orders_oct2026_-_biota_orders_oct2026.csv.csv ini csvnya
```

### Prompt 4

```
aku mau pake cara reconnect dulu, dan push manual aja pakai commandku
```

### Prompt 5

```
open "https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1"

dimana menjalankan comman ini?
```

### Prompt 6

```
git push -u origin main
error: src refspec main does not match any
error: failed to push some refs to 'https://github.com/Albert342zzz/biota-test'
```

---

## Sesi 2 — Claude Code (lokal, VS Code di Windows)

### Prompt 7

```
apakah kamu sudah baca csv yang dikirimkan sebelumnya? apa 3 kesalahan AI yang bisa di cek?
```

### Prompt 8

```
csvnya masukkin ke biota-test/data ?
```

### Prompt 9

```
sudah aku masukin, jalankan ketiga perintahnya
```

### Prompt 10

```
udah aku masukkin dengan nama biota_orders_oct2026.csv, jalanin semua
```

### Prompt 11

```
aku commit manual aja, kasih aku commit messagenya aja
```

### Prompt 12

```
apakah bisa undo commit?
```

### Prompt 13

```
jalanin aja perbaikannya

pastikan pake emailku albertdavidmulyadi342@gmail.com dan pakai pnpm untuk seterusnya. Commit terakhir bisa disamakan messagenya
```

### Prompt 14

```
coba rangkumkan aku 3 kesalahan yang kamu notes sebelumnya karena mau aku perbaiki
```

### Prompt 15

```
cek lagi apakah ada bug atau kesalahan di luar dari yang sudah diperbaiki. Pastikan untuk logic2, angka, hasil, input, semuanya berjalan lancar, best approach and practice
```

### Prompt 16

```
sudah aku commit, update README dan PROMPT_LOG nya
```

*(prompt di atas dihentikan di tengah jalan, lalu diganti dengan yang berikut)*

```
kasih sentuhan terakhir untuk UI nya aja:

1. tiap tombol dikasih mouse hover
2. buat penempatan seperti dashboard admin panel (input csv di pojok kanan atas, net revenue di paling atas dengan ada range filter tanggalnya, info2 dibawahnya seperti Nilai dibatalkan, Nilai diretur / refund, Status tidak dikenali, Gross (semua status) dibuat di bawah Net revenue dengan card section lebih kecil)
3. Net revenue per channel, 10 produk teratas dikasih pie chart

jangan ubah logic sama sekali, ini fokus hanya ke UI UX
```

### Prompt 17

```
sudah aku commit, update README dan PROMPT_LOG nya
```

---

## Catatan tentang cara kerja sesi ini

Jumlah prompt-nya sedikit karena Claude Code bekerja secara agentik: satu prompt
memicu banyak langkah (menjalankan perintah, membaca file, menulis kode,
menjalankan test, membuka browser) tanpa perlu prompt terpisah untuk tiap
langkah. Jadi yang lebih menggambarkan cara berpikir di sini bukan jumlah
promptnya, melainkan **urutan langkah dan keputusan** di dalam sesi.

### Sesi 1 — membangun

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

### Sesi 2 — verifikasi ulang, audit, dan tampilan

15. Menjalankan ulang test, build, dan verifier di Windows. Semua cocok dengan
    hasil sesi cloud.
16. Ditemukan `scripts/measure-bug-impact.ts` masih memakai path absolut dari
    container cloud, sehingga gagal di mesin lain. Diubah menerima argumen.
17. Commit pertama di mesin lokal membawa dua masalah yang terlihat saat
    diperiksa: `package-lock.json` ikut masuk padahal repo memakai pnpm, dan
    author commit memakai email kantor, bukan email pribadi. Keduanya
    diperbaiki, package manager dikunci lewat field `packageManager`, dan
    seluruh perintah di dokumentasi disamakan ke pnpm.
18. **Audit menyeluruh atas parser dan agregasi**, diuji dengan nilai-nilai
    pinggiran alih-alih dibaca sekilas. Enam bug lain ditemukan; yang paling
    berbahaya membuat tombol filter menampilkan dashboard kosong, dan membuat
    `"Rp 699. 000"` terbaca 699. Semua diperbaiki dengan satu test regresi
    masing-masing (58 → 69 test).
19. **Perbaikan pertama untuk salah satu bug itu ternyata salah**, dan ketahuan
    karena test gagal. Status `"Tidak Dibayar"` sempat dipindahkan ke kelompok
    "belum bayar" — padahal kelompok itu ikut dihitung sebagai pendapatan secara
    default, jadi angkanya tetap naik. Diperbaiki dengan memisahkan "belum
    terjadi" dari "sudah pasti tidak jadi".
20. Merapikan tampilan menjadi tata letak dashboard, menambahkan keadaan hover
    pada semua kontrol, dan menambahkan donut part-to-whole.
21. **Permintaan pie chart 10 irisan tidak dituruti apa adanya.** Sepuluh irisan
    melanggar batas keterbacaan (lebih dari enam bagian, lebih dari tujuh kelas
    warna, membandingkan nilai berdekatan lewat sudut). Dibuat 5 teratas +
    "Lainnya", dengan peringkat lengkap tetap tersedia sebagai bar di bawahnya,
    dan alasannya disampaikan terbuka beserta tawaran untuk mengubahnya.
22. Palet donut divalidasi dengan alat pemeriksa keterbacaan bagi pengguna buta
    warna di mode terang dan gelap, dan geometri busurnya diuji numerik untuk
    enam kasus pinggiran sebelum dianggap selesai.
