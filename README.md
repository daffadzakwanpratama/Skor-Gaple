# 🃏 Skor Gaple & Truf Remi

Aplikasi web pencatat skor **Gaple** dan **Truf Remi** bergaya **Neobrutalism**, cepat, ringan, dan mendukung **PWA (Progressive Web App)** sehingga bisa di-install serta digunakan secara offline di HP maupun desktop.

🌐 **Live Web App:** [daffadzakwanpratama.github.io/Skor-Gaple](https://daffadzakwanpratama.github.io/Skor-Gaple/)

---

## ✨ Fitur Utama

### 1. 🁣 Mode Gaple (`index.html`)
- Pencatatan skor pemain Gaple secara real-time.
- Antarmuka bersih dengan gaya **Neobrutalism** yang tegas dan mudah dibaca saat bermain bersama.
- Penyimpanan otomatis di `localStorage` sehingga skor tidak hilang jika halaman di-refresh.

### 2. ♠️ Mode Truf Remi (`truf.html`)
- **Fase Bid (Penawaran):**
  - Input bid cepat menggunakan **Numpad Kalkulator (0–13)** dan pilihan jenis truf (`♠`, `♥`, `♣`, `♦`).
  - Otomatis mendeteksi mode permainan **ATAS** (`totalBid > 13`) atau **BAWAH** (`totalBid < 13`) beserta penentuan pemenang bid tertinggi.
- **Fase Hasil Ronde:**
  - Tombol **Book** untuk langsung mengisi hasil sesuai tawaran bid pemain.
  - Tombol **Sisa (n)** di numpad untuk mengisi sisa kartu agar total pas **13/13** dengan cepat.
  - Perhitungan poin otomatis (termasuk aturan **Bid 0** di mode ATAS `+5` / BAWAH `+10`, penalti gagal bid 0, serta penalti lebih/kurang).
- **Set Skor Manual:**
  - Tombol **Set Skor** di pojok kanan atas untuk memindahkan atau menyesuaikan total skor dari catatan fisik/buku (lengkap dengan toggle `+`/`-`).
- **Klasemen, Riwayat & Status Kocok:**
  - Klasemen langsung, riwayat per ronde, serta pelacakan pemain yang bertugas **Kocok** (termasuk status streak).

### 3. 📱 Progressive Web App (PWA)
- Didukung Service Worker (`sw.js`) dan `manifest.json`.
- Bisa di-install ke layar utama Android/iOS/Desktop dan tetap berjalan lancar tanpa koneksi internet.

---

## 🛠️ Teknologi yang Digunakan

- **HTML5, CSS3, Vanilla JavaScript** (tanpa framework berat, super cepat)
- **Neobrutalism UI** (`css/neobrutalism.css`)
- **Service Worker & Web App Manifest** untuk dukungan offline & installable PWA

---

## 📂 Struktur Proyek

```text
skor-gaple/
├── index.html          # Halaman utama (Mode Gaple)
├── truf.html           # Halaman Mode Truf Remi
├── manifest.json       # Konfigurasi PWA
├── sw.js               # Service Worker untuk caching offline
├── css/
│   └── neobrutalism.css
└── js/
    ├── app.js          # Logika Mode Gaple
    └── truf.js         # Logika Mode Truf Remi
```

---

## 🚀 Cara Menjalankan Secara Lokal

1. Clone repository ini:
   ```bash
   git clone https://github.com/daffadzakwanpratama/Skor-Gaple.git
   ```
2. Masuk ke folder proyek:
   ```bash
   cd Skor-Gaple
   ```
3. Buka `index.html` menggunakan Live Server (VS Code) atau jalankan server statis sederhana, misalnya:
   ```bash
   npx serve .
   ```

---

<p align="center">
  Dibuat untuk memudahkan hitung skor mabar Gaple & Truf Remi 🎲
</p>
