const fetch = require('node-fetch');
const config = require('./config');

/**
 * CATATAN PENTING:
 * Kamu sudah punya autogopay.js yang JALAN di project telegram-shop-bot kamu.
 * Supaya konsisten & pasti benar, PALING AMAN adalah copy isi function
 * generateQRIS + verifyWebhook dari file itu ke sini, ganti dua function di
 * bawah ini. Kerangka di bawah mengikuti kontrak umum AutoGoPay
 * (POST /qris/generate -> { transaction_id, qr_url, checkout_url }) sebagai
 * fallback kalau kamu mulai project ini dari nol.
 */

async function generateQRIS({ amount, note }) {
  const res = await fetch(`${config.autogopay.baseUrl}/qris/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.autogopay.apiKey}`,
    },
    body: JSON.stringify({ amount, note }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AutoGoPay error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    trxId: data.transaction_id || data.data?.transaction_id,
    qrUrl: data.qr_url || data.data?.qr_url,
    checkoutUrl: data.checkout_url || data.data?.checkout_url,
    raw: data,
  };
}

async function checkStatus(trxId) {
  const res = await fetch(`${config.autogopay.baseUrl}/qris/status/${trxId}`, {
    headers: { Authorization: `Bearer ${config.autogopay.apiKey}` },
  });
  if (!res.ok) throw new Error(`AutoGoPay status check gagal: ${res.status}`);
  return res.json();
}

/**
 * Verifikasi payload webhook. Sesuaikan dengan skema signature AutoGoPay yang
 * sebenarnya kamu pakai (header X-Signature / HMAC / dsb) — ambil dari
 * webhookServer.js di project telegram-shop-bot kamu.
 */
function isPaidPayload(body) {
  const status = body.status || body.data?.status;
  return status === 'paid' || status === 'success' || status === 'settlement';
}

module.exports = { generateQRIS, checkStatus, isPaidPayload };
