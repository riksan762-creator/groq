# Kilat — Chatbot AI Customer Service untuk UMKM

Proyek ini ada 2 bagian:

- **`backend/`** → API server (Node.js/Express). Ini yang kamu taro di **VPS**.
- **`frontend/`** → Landing page + admin dashboard (HTML statis). Ini yang kamu **hosting di GitHub Pages**.

---

## 1. Deploy backend ke VPS

### Syarat
- VPS dengan Node.js 18+ terinstall (`node -v` untuk cek)
- Akun [Groq](https://console.groq.com) → ambil API key
- Akun [AutoGoPay](https://autogopay.site/register) → daftar gratis, lalu beli **Activation Key** lewat bot Telegram [@AutoGopayBot](https://t.me/AutoGopayBot) untuk mengaktifkan koneksi ke GoPay/ShopeePay, baru ambil API key dari dashboard AutoGoPay

### Langkah
```bash
# upload folder backend/ ke VPS, lalu:
cd backend
npm install
cp .env.example .env
nano .env   # isi GROQ_API_KEY, AUTOGOPAY_API_KEY, JWT_SECRET, dst
node server.js
```

Supaya server tetap jalan setelah kamu logout dari SSH, pakai **pm2**:
```bash
npm install -g pm2
pm2 start server.js --name kilat-backend
pm2 save
pm2 startup   # ikuti instruksi yang muncul
```

### Kasih domain + HTTPS (wajib untuk webhook AutoGoPay)
Pasang **Nginx** sebagai reverse proxy ke port 4000 (atau sesuai `PORT` di `.env`), lalu pasang SSL gratis pakai **Certbot**. Setelah itu:
- Backend kamu bisa diakses lewat `https://api.domainkamu.com`
- Set URL ini di dashboard AutoGoPay sebagai **callback URL**: `https://api.domainkamu.com/api/billing/webhook`

---

## 2. Deploy frontend ke GitHub Pages

1. Buat repo baru di GitHub, upload isi folder `frontend/` (`index.html`, `admin.html`) ke branch `main`.
2. Buka **Settings → Pages** di repo tersebut, pilih source: branch `main`, folder `/ (root)`.
3. Tunggu beberapa menit, situs kamu aktif di `https://usernamekamu.github.io/nama-repo/`.

### Penting: sambungkan frontend ke backend
Buka file `admin.html`, cari baris ini di bagian `<script>` paling bawah:
```js
const API_BASE = "https://api.domainkamu.com";
```
Ganti dengan URL backend kamu yang sudah live di VPS. Commit & push ulang.

---

## 3. Coba end-to-end
1. Buka `index.html` (landing page) → klik "Coba Gratis" → daftar akun.
2. Di dashboard, buka tab **Pengaturan Bot**, isi info produk/tokomu.
3. Buka tab **Pasang Widget**, salin kodenya, tempel ke file HTML website tokomu sebelum `</body>`.
4. Buka website tokomu, coba chat lewat bubble yang muncul di pojok kanan bawah.
5. Kalau mau tes upgrade paket, buka tab **Langganan** → pilih paket → scan QRIS yang muncul.

---

## Struktur folder
```
backend/
  server.js          # entry point
  db.js              # database sederhana berbasis file JSON
  plans.js           # daftar paket & harga
  routes/
    auth.js          # register, login
    bot.js           # pengaturan chatbot + riwayat percakapan
    chat.js          # endpoint publik yang dipanggil widget
    billing.js        # checkout + webhook AutoGoPay
  utils/
    groq.js          # panggil Groq API
    autogopay.js     # panggil AutoGoPay API + verifikasi webhook
  public/widget.js   # script chat yang ditempel di website UMKM

frontend/
  index.html         # landing page
  admin.html         # dashboard merchant
```

## Catatan keamanan
- Jangan commit file `.env` ke GitHub — isinya API key rahasia.
- `JWT_SECRET` harus string acak yang panjang, jangan ditebak.
- Endpoint webhook AutoGoPay sudah diverifikasi pakai signature HMAC, jangan dihapus bagian itu.

## Mau dikembangkan lagi?
Beberapa ide lanjutan yang belum dibuat di versi ini:
- Notifikasi WhatsApp/Telegram ke pemilik toko saat ada chat baru
- Multi-admin per toko
- Upload katalog produk dari file Excel/CSV supaya bot makin akurat
- Integrasi langsung ke WhatsApp Business API (bukan cuma widget website)
