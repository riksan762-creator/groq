require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-ganti-ini',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    textModel: process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b',
    visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    baseUrl: 'https://api.groq.com/openai/v1',
  },

  autogopay: {
    apiKey: process.env.AUTOGOPAY_API_KEY,
    baseUrl: process.env.AUTOGOPAY_BASE_URL || 'https://autogopay.site/api',
    webhookSecret: process.env.AUTOGOPAY_WEBHOOK_SECRET || '',
  },

  // Paket top-up kredit — ubah sesuka hati lewat admin panel > Pengaturan
  defaultPackages: [
    { credits: 10, priceRp: 5000 },
    { credits: 25, priceRp: 10000 },
    { credits: 60, priceRp: 20000 },
  ],

  // Berapa kali pengunjung (belum daftar) boleh coba AI gratis per hari, per IP
  trialLimitPerDay: 3,
};
