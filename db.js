// db.js
// Database sederhana berbasis file JSON. Cukup untuk skala ratusan-ribuan
// merchant UMKM tanpa perlu setup database server terpisah di VPS.
// Kalau nanti mau scale besar, tinggal ganti isi modul ini dengan Postgres/MySQL
// — semua route lain memanggil lewat fungsi-fungsi di file ini saja.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function defaultData() {
  return {
    merchants: [],       // akun UMKM yang daftar
    conversations: [],   // log chat widget <-> pelanggan
    transactions: []      // riwayat pembayaran AutoGoPay
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData(), null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('DB corrupt, membuat ulang dari kosong:', e.message);
    return defaultData();
  }
}

// Antrean tulis sederhana supaya tidak ada race condition saat beberapa
// request menulis file JSON ini secara bersamaan.
let writeChain = Promise.resolve();
function save(data) {
  writeChain = writeChain.then(() => {
    return fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2));
  });
  return writeChain;
}

// Bungkus baca-ubah-simpan supaya konsisten
async function withDB(mutatorFn) {
  const data = load();
  const result = await mutatorFn(data);
  await save(data);
  return result;
}

module.exports = { load, save, withDB };
