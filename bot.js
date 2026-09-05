// routes/bot.js
const express = require('express');
const { withDB, load } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/bot-config', requireAuth, (req, res) => {
  const db = load();
  const merchant = db.merchants.find(m => m.id === req.merchantId);
  if (!merchant) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
  res.json({ success: true, bot_config: merchant.bot_config, widget_key: merchant.widget_key });
});

router.put('/bot-config', requireAuth, async (req, res) => {
  const { greeting, system_prompt, tone } = req.body || {};

  const updated = await withDB(async (data) => {
    const merchant = data.merchants.find(m => m.id === req.merchantId);
    if (!merchant) return null;
    if (typeof greeting === 'string') merchant.bot_config.greeting = greeting;
    if (typeof system_prompt === 'string') merchant.bot_config.system_prompt = system_prompt;
    if (typeof tone === 'string') merchant.bot_config.tone = tone;
    return merchant.bot_config;
  });

  if (!updated) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
  res.json({ success: true, bot_config: updated });
});

router.get('/conversations', requireAuth, (req, res) => {
  const db = load();
  const items = db.conversations
    .filter(c => c.merchant_id === req.merchantId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 200);
  res.json({ success: true, conversations: items });
});

module.exports = router;
