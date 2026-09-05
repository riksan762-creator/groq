// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const chatRoutes = require('./routes/chat');
const { router: billingRoutes, webhookHandler } = require('./routes/billing');

const app = express();

app.use(cors()); // widget dipasang di domain UMKM mana pun -> harus terbuka

// PENTING: route webhook didaftarkan SEBELUM express.json(), dan pakai
// express.raw(), karena verifikasi signature AutoGoPay butuh raw body mentah.
app.post('/api/billing/webhook', express.raw({ type: '*/*' }), webhookHandler);

// --- middleware & route lain, pakai JSON parser normal ---
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'Kilat backend', docs: 'lihat README.md' });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api', authRoutes);
app.use('/api', botRoutes);
app.use('/api', chatRoutes);
app.use('/api', billingRoutes);

app.get('/widget.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan di server.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Kilat backend jalan di port ${PORT}`);
});
