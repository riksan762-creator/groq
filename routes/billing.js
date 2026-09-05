// routes/billing.js
const express = require('express');
const crypto = require('crypto');
const { withDB, load } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateQris, verifyWebhookSignature } = require('../utils/autogopay');
const { PLANS } = require('../plans');

const router = express.Router();

// Merchant klik "Upgrade" di dashboard -> bikin QRIS AutoGoPay
router.post('/billing/checkout', requireAuth, async (req, res) => {
  const { plan } = req.body || {};
  const planDef = PLANS[plan];

  if (!planDef || planDef.price <= 0) {
    return res.status(400).json({ success: false, message: 'Paket tidak valid.' });
  }

  let qris;
  try {
    qris = await generateQris(planDef.price);
  } catch (err) {
    console.error('AutoGoPay error:', err.message);
    return res.status(502).json({ success: false, message: 'Gagal membuat QRIS pembayaran. Coba lagi sebentar.' });
  }

  await withDB(async (data) => {
    data.transactions.push({
      id: crypto.randomUUID(),
      merchant_id: req.merchantId,
      plan,
      amount: planDef.price,
      autogopay_transaction_id: qris.transaction_id,
      autogopay_order_id: qris.order_id,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  });

  res.json({
    success: true,
    checkout_url: qris.checkout_url,
    qr_url: qris.qr_url,
    amount: planDef.price,
    expiry_time: qris.expiry_time,
    transaction_id: qris.transaction_id
  });
});

router.get('/billing/status', requireAuth, (req, res) => {
  const db = load();
  const merchant = db.merchants.find(m => m.id === req.merchantId);
  if (!merchant) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });

  const myTx = db.transactions
    .filter(t => t.merchant_id === req.merchantId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  res.json({ success: true, subscription: merchant.subscription, usage: merchant.usage, transactions: myTx, plans: PLANS });
});

// Handler webhook AutoGoPay. TIDAK didaftarkan lewat router ini karena butuh
// express.raw() (bukan express.json()) supaya rawBody tersedia untuk verifikasi
// signature. Lihat server.js: didaftarkan langsung di app, sebelum express.json().
async function webhookHandler(req, res) {
  const signature = req.headers['x-signature'];
  const rawBody = req.body; // Buffer, karena route ini pakai express.raw()

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Payload tidak valid' });
  }

  const tx = payload.transaction;
  if (!tx || payload.event !== 'transaction.received' || tx.status !== 'PAID') {
    return res.json({ success: true }); // ack saja, tidak ada yang perlu diproses
  }

  await withDB(async (data) => {
    const record = data.transactions.find(t => t.autogopay_transaction_id === tx.transaction_id);
    if (!record || record.status === 'paid') return; // sudah diproses / tidak dikenal -> hindari double-process

    record.status = 'paid';
    record.paid_at = tx.paid_at;

    const merchant = data.merchants.find(m => m.id === record.merchant_id);
    if (!merchant) return;

    const planDef = PLANS[record.plan];
    const now = new Date();
    const currentExpiry = merchant.subscription.expires_at ? new Date(merchant.subscription.expires_at) : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(base.getTime() + planDef.duration_days * 24 * 60 * 60 * 1000);

    merchant.subscription = {
      plan: record.plan,
      status: 'active',
      expires_at: newExpiry.toISOString()
    };
  });

  res.json({ success: true });
}

module.exports = { router, webhookHandler };
