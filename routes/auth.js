// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { withDB, load } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { PLANS } = require('../plans');

const router = express.Router();

function publicMerchant(m) {
  const { password_hash, ...rest } = m;
  return rest;
}

router.post('/register', async (req, res) => {
  const { business_name, email, password } = req.body || {};

  if (!business_name || !email || !password) {
    return res.status(400).json({ success: false, message: 'business_name, email, dan password wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
  }

  const db = load();
  const exists = db.merchants.find(m => m.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(409).json({ success: false, message: 'Email sudah terdaftar. Coba login.' });
  }

  const merchant = {
    id: crypto.randomUUID(),
    business_name,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    widget_key: crypto.randomBytes(12).toString('hex'),
    created_at: new Date().toISOString(),
    subscription: {
      plan: 'trial',
      status: 'active',
      expires_at: null
    },
    bot_config: {
      greeting: `Halo! Selamat datang di ${business_name}. Ada yang bisa saya bantu?`,
      system_prompt: '',
      tone: 'ramah, sopan, dan to the point'
    },
    usage: {
      month: new Date().toISOString().slice(0, 7),
      messages_used: 0
    }
  };

  await withDB(async (data) => {
    data.merchants.push(merchant);
  });

  const token = jwt.sign({ merchantId: merchant.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, merchant: publicMerchant(merchant) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = load();
  const merchant = db.merchants.find(m => m.email.toLowerCase() === (email || '').toLowerCase());

  if (!merchant || !bcrypt.compareSync(password || '', merchant.password_hash)) {
    return res.status(401).json({ success: false, message: 'Email atau password salah.' });
  }

  const token = jwt.sign({ merchantId: merchant.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, merchant: publicMerchant(merchant) });
});

router.get('/me', requireAuth, (req, res) => {
  const db = load();
  const merchant = db.merchants.find(m => m.id === req.merchantId);
  if (!merchant) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
  res.json({ success: true, merchant: publicMerchant(merchant), plans: PLANS });
});

module.exports = router;
