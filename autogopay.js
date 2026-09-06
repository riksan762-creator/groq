const fetch = require('node-fetch');
const crypto = require('crypto');
const config = require('./config');

/**
 * Wrapper untuk AutoGoPay (https://autogopay.site/docs), fitur GoPay QRIS.
 * Base URL resmi: https://v1-gateway.autogopay.site
 * Semua request pakai header: Authorization: Bearer <API_KEY>
 */

async function generateQRIS({ amount }) {
  const res = await fetch(`${config.autogopay.baseUrl}/qris/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.autogopay.apiKey}`,
    },
    body: JSON.stringify({ amount }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || `AutoGoPay error ${res.status}`);
  }

  return {
    trxId: data.data.transaction_id,
    orderId: data.data.order_id,
    qrUrl: data.data.qr_url,
    checkoutUrl: data.data.checkout_url,
    expiryTime: data.data.expiry_time,
    raw: data.data,
  };
}

async function checkStatus(transactionId) {
  const res = await fetch(`${config.autogopay.baseUrl}/qris/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.autogopay.apiKey}`,
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  });
  return res.json(); // { success, data: { status: 'pending'|'settlement'|'expire'|'cancel', ... } }
}

async function cancelQRIS(transactionId) {
  const res = await fetch(`${config.autogopay.baseUrl}/qris/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.autogopay.apiKey}`,
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  });
  return res.json();
}

/**
 * Wajib menurut docs: verifikasi header X-Signature (HMAC-SHA256, API key
 * sebagai secret) atas RAW BODY webhook — jangan verifikasi hasil JSON.parse,
 * karena re-serialize bisa mengubah urutan/format string dan bikin signature
 * mismatch.
 */
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', config.autogopay.apiKey)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // panjang buffer beda -> jelas tidak match
  }
}

// Payload webhook: { event: 'transaction.received', transaction: { transaction_id, status: 'PAID', payment_method, ... } }
function isPaidPayload(body) {
  return body?.event === 'transaction.received' && body?.transaction?.status === 'PAID';
}

function getTransactionId(body) {
  return body?.transaction?.transaction_id;
}

module.exports = { generateQRIS, checkStatus, cancelQRIS, verifySignature, isPaidPayload, getTransactionId };
