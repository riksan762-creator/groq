// plans.js
// Definisi paket berlangganan. Ubah harga/kuota di sini kalau mau eksperimen pricing.

const PLANS = {
  trial: { name: 'Trial', price: 0, quota: 50, duration_days: null },
  pro: { name: 'Pro', price: 49000, quota: 1000, duration_days: 30 },
  bisnis: { name: 'Bisnis', price: 149000, quota: 5000, duration_days: 30 }
};

module.exports = { PLANS };
