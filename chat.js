// routes/chat.js
// Endpoint PUBLIK (tanpa login) yang dipanggil oleh widget.js dari website UMKM mana pun.
// Dilindungi bukan oleh JWT, tapi oleh widget_key unik per merchant + kuota bulanan.

const express = require('express');
const crypto = require('crypto');
const { withDB, load } = require('../db');
const { askGroq, buildSystemPrompt } = require('../utils/groq');
const { PLANS } = require('../plans');

const router = express.Router();

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function isSubscriptionActive(merchant) {
  const { plan, status, expires_at } = merchant.subscription;
  if (plan === 'trial') return status === 'active';
  if (status !== 'active') return false;
  if (expires_at && new Date(expires_at) < new Date()) return false;
  return true;
}

router.post('/chat/:widgetKey', async (req, res) => {
  const { widgetKey } = req.params;
  const { message, session_id } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Pesan kosong.' });
  }

  const db = load();
  const merchant = db.merchants.find(m => m.widget_key === widgetKey);
  if (!merchant) {
    return res.status(404).json({ success: false, message: 'Widget key tidak dikenal.' });
  }

  // Reset kuota tiap ganti bulan
  if (merchant.usage.month !== currentMonth()) {
    merchant.usage.month = currentMonth();
    merchant.usage.messages_used = 0;
  }

  if (!isSubscriptionActive(merchant)) {
    return res.status(402).json({ success: false, message: 'Langganan tidak aktif. Silakan upgrade paket di dashboard.' });
  }

  const quota = PLANS[merchant.subscription.plan]?.quota ?? PLANS.trial.quota;
  if (merchant.usage.messages_used >= quota) {
    return res.status(429).json({ success: false, message: 'Kuota pesan bulan ini habis. Upgrade paket untuk lanjut.' });
  }

  const sid = session_id || crypto.randomUUID();

  // Ambil 10 pesan terakhir di sesi ini sebagai konteks percakapan
  const history = db.conversations
    .filter(c => c.merchant_id === merchant.id && c.session_id === sid)
    .slice(-10)
    .map(c => ({ role: c.role, content: c.content }));

  let reply;
  try {
    reply = await askGroq({
      systemPrompt: buildSystemPrompt(merchant.bot_config, merchant),
      history,
      userMessage: message
    });
  } catch (err) {
    console.error('Groq error:', err.message);
    return res.status(502).json({ success: false, message: 'Chatbot lagi gangguan, coba lagi sebentar ya.' });
  }

  await withDB(async (data) => {
    const m = data.merchants.find(x => x.id === merchant.id);
    m.usage = merchant.usage;
    m.usage.messages_used += 1;

    const now = new Date().toISOString();
    data.conversations.push({
      id: crypto.randomUUID(),
      merchant_id: merchant.id,
      session_id: sid,
      role: 'user',
      content: message,
      created_at: now
    });
    data.conversations.push({
      id: crypto.randomUUID(),
      merchant_id: merchant.id,
      session_id: sid,
      role: 'assistant',
      content: reply,
      created_at: now
    });
  });

  res.json({ success: true, reply, session_id: sid });
});

// Info publik ringan untuk widget (nama bisnis + sapaan), dipanggil sekali saat widget dibuka
router.get('/widget-info/:widgetKey', (req, res) => {
  const db = load();
  const merchant = db.merchants.find(m => m.widget_key === req.params.widgetKey);
  if (!merchant) return res.status(404).json({ success: false, message: 'Widget key tidak dikenal.' });
  res.json({
    success: true,
    business_name: merchant.business_name,
    greeting: merchant.bot_config.greeting
  });
});

module.exports = router;
