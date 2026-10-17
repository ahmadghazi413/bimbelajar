# Bimbelajar

Buatkan website platform les ngaji online (membaca Al-Qur'an dari nol untuk dewasa dan ibu-ibu)  dalam Bahasa Indonesia. Tampilan mobile-first, bersih, hangat, dan mudah dipakai orang awam. Warna utama [hijau tua/biru], nama brand: [Bimbelajar].



HALAMAN PUBLIK

- Beranda: penjelasan singkat program, keunggulan (belajar tanpa malu, guru sabar, dari rumah), tombol "Daftar" dan "Lihat Kelas".

- Daftar kelas: kartu kelas (Kelas Besar, Kelas Kecil, Privat) berisi level, jadwal, kuota, dan harga.

- Detail kelas: deskripsi, tujuan, daftar sesi per level (16 sesi per level, tiap sesi ada judul dan deskripsi singkat), tombol "Daftar dan Bayar".



AKUN (LOGIN)

- Daftar dan masuk dengan email + password, atau Google. Lupa password lewat email.

- Peran: murid dan admin.



ALUR MURID

1. Login, pilih kelas, lihat deskripsi sesi.

2. Bayar online: transfer virtual account, QRIS, dan e-wallet lewat [Midtrans/Xendit]. Status pembayaran otomatis berubah setelah lunas.

3. Setelah lunas, kelas muncul di "Kelas Saya" dan murid melihat tombol "Gabung Grup WhatsApp" (link berbeda per kelas) serta link Zoom dan jadwal sesi.

4. Menu "Riwayat Video": daftar rekaman sesi dari kelas yang diikuti, dikelompokkan per level dan sesi, dengan pemutar video (embed link YouTube unlisted/Vimeo/Google Drive). Hanya murid yang sudah bayar yang bisa mengakses.

5. Menu "Riwayat Pembayaran" dan "Profil".

6. (Opsional) Progres belajar: level saat ini dan hasil tes.



PANEL ADMIN

- Kelola kelas: tambah/ubah kelas, harga, kuota, jadwal, link grup WhatsApp, link Zoom.

- Kelola sesi dan deskripsinya per level.

- Unggah/tempel link rekaman per sesi.

- Lihat daftar peserta per kelas dan status pembayaran (bisa konfirmasi manual untuk transfer biasa).

- Dashboard sederhana: jumlah murid, pemasukan bulan ini.



KETENTUAN

- Data awal: 3 kelas contoh (Kelas Besar Rp100.000/bulan, Kelas Kecil Rp250.000/bulan, Privat mulai Rp300.000/bulan), harga bisa diubah admin.

- Akses video dan link grup hanya untuk murid yang pembayarannya lunas.

- Gunakan database dan autentikasi bawaan (misalnya Supabase), semua teks Bahasa Indonesia.

- Buat dulu versi dasar yang berjalan end-to-end (daftar, bayar, akses kelas, lihat video), baru tambah fitur opsional.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bimbelajar.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0cd78113-fe04-5066-bd17-f1d4ddd6633f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
