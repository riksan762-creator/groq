# KontenKilat

AI Caption & Konten Jualan buat UMKM — powered by Groq. Input nama produk, kategori, harga (+ foto opsional) → keluar caption Instagram, caption TikTok, hashtag, dan deskripsi marketplace sekaligus. Monetisasi lewat kredit yang dibeli via QRIS (AutoGoPay).

## Fitur

- **Landing page**: hero dengan live demo animasi, form generator, widget "coba AI" gratis (3x/hari per IP), paket top up kredit.
- **Generator**: teks + opsional foto produk (pakai model vision Groq kalau ada foto).
- **Auth sederhana**: daftar/login pakai nomor WhatsApp + password, bonus 3 kredit gratis saat daftar.
- **Top up QRIS**: generate QRIS dinamis via AutoGoPay, kredit masuk otomatis lewat webhook.
- **Admin panel** (`/admin.html`): dashboard ringkasan, kelola user (ubah kredit / nonaktifkan / hapus, lewat menu ⋯), riwayat transaksi, dan pengaturan paket kredit + prompt AI.

## Setup

```bash
npm install
cp .env.example .env
# isi .env: GROQ_API_KEY, AUTOGOPAY_API_KEY, JWT_SECRET, ADMIN_PASSWORD
npm start
```

Buka `http://localhost:3000` untuk landing page, `http://localhost:3000/admin.html` untuk admin panel (login pakai `ADMIN_PASSWORD` dari `.env`).

## Yang WAJIB kamu sesuaikan sebelum production

1. **`server/autogopay.js`** — ini kerangka umum berdasarkan pola AutoGoPay (`POST /qris/generate`). Kamu sudah punya `autogopay.js` yang jalan di project telegram-shop-bot kamu — **copy langsung logic `generateQRIS` dan verifikasi webhook dari situ** ke file ini supaya endpoint, header auth, dan format signature-nya pasti sama persis dengan yang sudah terbukti jalan.
2. **Model Groq** (`GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL` di `.env`) — Groq cukup sering deprecate model lama. Cek daftar model aktif di https://console.groq.com/docs/models sebelum deploy, dan ganti kalau perlu.
3. **Webhook URL** — daftarkan `https://domainkamu.com/api/webhook/autogopay` di dashboard AutoGoPay supaya notifikasi pembayaran masuk otomatis.
4. **Ganti `JWT_SECRET` dan `ADMIN_PASSWORD`** ke string acak yang kuat, jangan pakai nilai default.

## Deploy ke VPS

```bash
# di VPS
git clone <repo-kamu>
cd kontenkilat
npm install --production
cp .env.example .env   # isi sesuai server/autogopay.js di atas
npm install -g pm2
pm2 start server/server.js --name kontenkilat
pm2 save
```

Pasang Nginx reverse proxy ke port yang ada di `.env` (default 3000) + SSL (certbot) seperti biasa kamu setup buat bot Telegram-mu.

## Struktur data

Data disimpan di `data/db.json` (JSON file, sama pola dengan project bot Telegram kamu) — cukup untuk skala awal. Kalau traffic sudah besar, tinggal ganti `server/db.js` ke database sungguhan (SQLite/Postgres) tanpa mengubah kontrak fungsi di file lain.
