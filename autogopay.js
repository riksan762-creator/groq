// utils/autogopay.js
// Wrapper untuk AutoGoPay API — dipakai untuk membuat QRIS pembayaran upgrade paket
// dan memverifikasi webhook saat pembayaran masuk.
// Dokumentasi: https://autogopay.site/docs

const crypto = require('crypto');

const BASE_URL = process.env.AUTOGOPAY_BASE_URL || 'https://v1-gateway.autogopay.site';

async function generateQris(amount) {
  const res = await fetch(`${BASE_URL}/qris/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AUTOGOPAY_API_KEY}`
    },
    body: JSON.stringify({ amount })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || `AutoGoPay error ${res.status}`);
  }
  return data.data;
  // -> { transaction_id, order_id, amount, transaction_status, qr_string, qr_url, checkout_url, expiry_time }
}

async function checkQrisStatus(transaction_id) {
  const res = await fetch(`${BASE_URL}/qris/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AUTOGOPAY_API_KEY}`
    },
    body: JSON.stringify({ transaction_id })
  });
  const data = await res.json();
  return data;
}

// Webhook AutoGoPay wajib diverifikasi pakai HMAC-SHA256 dengan API key sebagai secret.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.AUTOGOPAY_API_KEY)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // panjang beda dll -> pasti tidak valid
  }
}

module.exports = { generateQris, checkQrisStatus, verifyWebhookSignature };
