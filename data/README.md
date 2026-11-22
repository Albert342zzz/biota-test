# Folder data

File `biota_orders_oct2026.csv` **sengaja tidak di-commit** ke repository ini.

Brief tes meminta agar data tidak disebarkan, dan repository ini publik. Jadi
file aslinya hanya ada di mesin lokal.

Untuk mereproduksi angka di README utama, salin file ekspor ke folder ini:

```
data/biota_orders_oct2026.csv
```

lalu jalankan:

```
npm run verify -- data/biota_orders_oct2026.csv
```

Untuk mencoba aplikasinya tanpa data asli, pakai tombol **"Pakai data contoh"**
di dashboard. Data contoh itu dibuat oleh `scripts/generate-sample-csv.mjs` dan
isinya fiktif.
