const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { nanoid } = require('nanoid');
const path = require('path');

const config = require('./config');
const db = require('./db');
const groq = require('./groq');
const autogopay = require('./autogopay');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ---------- helpers ----------
function sign(user) {
  return jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Belum login' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.data.users[payload.id];
    if (!user || user.suspended) return res.status(401).json({ error: 'Akun tidak aktif' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid, silakan login lagi' });
  }
}

function adminAuth(req, res, next) {
  const token = (req.headers['x-admin-password'] || '');
  if (token !== config.adminPassword) return res.status(401).json({ error: 'Password admin salah' });
  next();
}

function packages() {
  return db.data.settings.packages || config.defaultPackages;
}

// ---------- auth ----------
app.post('/api/auth/register', (req, res) => {
  const { name, wa, password } = req.body;
  if (!name || !wa || !password) return res.status(400).json({ error: 'Lengkapi semua field' });
  const exists = Object.values(db.data.users).find((u) => u.wa === wa);
  if (exists) return res.status(400).json({ error: 'Nomor WA sudah terdaftar' });

  const id = nanoid(10);
  const user = {
    id,
    name,
    wa,
    passwordHash: bcrypt.hashSync(password, 10),
    credits: 3, // bonus 3 kredit gratis buat coba
    createdAt: new Date().toISOString(),
    suspended: false,
  };
  db.data.users[id] = user;
  db.save();
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { wa, password } = req.body;
  const user = Object.values(db.data.users).find((u) => u.wa === wa);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(400).json({ error: 'Nomor WA atau password salah' });
  }
  if (user.suspended) return res.status(403).json({ error: 'Akun kamu dinonaktifkan' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

function publicUser(u) {
  return { id: u.id, name: u.name, wa: u.wa, credits: u.credits, createdAt: u.createdAt };
}

// ---------- trial chat (publik, rate-limited per IP) ----------
app.post('/api/trial-chat', async (req, res) => {
  const ip = req.ip;
  const today = new Date().toISOString().slice(0, 10);
  const usage = db.data.trialUsage[ip] || { date: today, count: 0 };
  if (usage.date !== today) {
    usage.date = today;
    usage.count = 0;
  }
  if (usage.count >= config.trialLimitPerDay) {
    return res.status(429).json({ error: 'Kuota coba gratis hari ini sudah habis. Daftar untuk lanjut pakai penuh.' });
  }

  try {
    const { history } = req.body; // [{role:'user'|'assistant', content:'...'}]
    const reply = await groq.trialChat(history || []);
    usage.count += 1;
    db.data.trialUsage[ip] = usage;
    db.save();
    res.json({ reply, remaining: config.trialLimitPerDay - usage.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- generate konten ----------
app.post('/api/generate', auth, upload.single('photo'), async (req, res) => {
  if (req.user.credits < 1) return res.status(402).json({ error: 'Kredit kamu habis, silakan top up dulu' });

  try {
    const { productName, category, price, features } = req.body;
    const photoBase64 = req.file ? req.file.buffer.toString('base64') : null;
    const output = await groq.generateCaption({ productName, category, price, features, photoBase64 });

    req.user.credits -= 1;
    const id = nanoid(10);
    db.data.generations[id] = {
      id,
      userId: req.user.id,
      productName,
      category,
      price,
      features,
      output,
      createdAt: new Date().toISOString(),
    };
    db.save();
    res.json({ output, creditsLeft: req.user.credits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/history', auth, (req, res) => {
  const list = Object.values(db.data.generations)
    .filter((g) => g.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ history: list });
});

app.get('/api/packages', (req, res) => res.json({ packages: packages() }));

// ---------- topup (AutoGoPay QRIS) ----------
app.post('/api/topup', auth, async (req, res) => {
  try {
    const { credits } = req.body;
    const pkg = packages().find((p) => p.credits === credits);
    if (!pkg) return res.status(400).json({ error: 'Paket tidak ditemukan' });

    const { trxId, qrUrl, checkoutUrl } = await autogopay.generateQRIS({
      amount: pkg.priceRp,
      note: `KontenKilat ${pkg.credits} kredit - ${req.user.name}`,
    });

    const id = nanoid(10);
    db.data.transactions[id] = {
      id,
      userId: req.user.id,
      packageCredits: pkg.credits,
      priceRp: pkg.priceRp,
      status: 'pending',
      trxId,
      qrUrl,
      checkoutUrl,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    db.save();
    res.json({ transactionId: id, qrUrl, checkoutUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook publik dari AutoGoPay saat pembayaran masuk
app.post('/api/webhook/autogopay', (req, res) => {
  const body = req.body;
  const trx = Object.values(db.data.transactions).find((t) => t.trxId === (body.transaction_id || body.data?.transaction_id));
  if (!trx) return res.status(404).json({ ok: false });

  if (autogopay.isPaidPayload(body) && trx.status !== 'paid') {
    trx.status = 'paid';
    trx.paidAt = new Date().toISOString();
    const user = db.data.users[trx.userId];
    if (user) user.credits += trx.packageCredits;
    db.save();
  }
  res.json({ ok: true });
});

app.get('/api/transaction/:id', auth, (req, res) => {
  const trx = db.data.transactions[req.params.id];
  if (!trx || trx.userId !== req.user.id) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ transaction: trx });
});

// ---------- admin ----------
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const users = Object.values(db.data.users);
  const trxs = Object.values(db.data.transactions);
  const gens = Object.values(db.data.generations);
  res.json({
    totalUsers: users.length,
    totalRevenue: trxs.filter((t) => t.status === 'paid').reduce((s, t) => s + t.priceRp, 0),
    totalGenerations: gens.length,
    totalTransactionsPaid: trxs.filter((t) => t.status === 'paid').length,
  });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json({ users: Object.values(db.data.users).map(publicUser).map((u, i) => ({ ...u, suspended: Object.values(db.data.users)[i].suspended })) });
});

app.patch('/api/admin/users/:id', adminAuth, (req, res) => {
  const user = db.data.users[req.params.id];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { credits, suspended } = req.body;
  if (credits !== undefined) user.credits = credits;
  if (suspended !== undefined) user.suspended = suspended;
  db.save();
  res.json({ user: publicUser(user) });
});

app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  delete db.data.users[req.params.id];
  db.save();
  res.json({ ok: true });
});

app.get('/api/admin/transactions', adminAuth, (req, res) => {
  const list = Object.values(db.data.transactions)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({ ...t, userName: db.data.users[t.userId]?.name || '(dihapus)' }));
  res.json({ transactions: list });
});

app.get('/api/admin/settings', adminAuth, (req, res) => {
  res.json({ packages: packages(), promptTemplate: db.data.settings.promptTemplate });
});

app.patch('/api/admin/settings', adminAuth, (req, res) => {
  const { packages: newPackages, promptTemplate } = req.body;
  if (newPackages) db.data.settings.packages = newPackages;
  if (promptTemplate !== undefined) db.data.settings.promptTemplate = promptTemplate;
  db.save();
  res.json({ ok: true });
});

app.listen(config.port, () => console.log(`KontenKilat jalan di port ${config.port}`));
