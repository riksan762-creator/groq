// utils/groq.js
// Wrapper tipis untuk memanggil Groq Chat Completions API (kompatibel format OpenAI).

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function askGroq({ systemPrompt, history, userMessage }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.5,
      max_tokens: 600
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function buildSystemPrompt(botConfig, merchant) {
  const {
    business_name
  } = merchant;
  const {
    greeting,
    system_prompt,
    tone
  } = botConfig;

  return [
    `Kamu adalah asisten layanan pelanggan untuk bisnis bernama "${business_name}".`,
    `Gaya bicara kamu: ${tone || 'ramah, sopan, dan to the point'}.`,
    `Selalu balas dalam Bahasa Indonesia kecuali pelanggan menulis dalam bahasa lain.`,
    `Informasi tentang bisnis ini (gunakan ini sebagai sumber kebenaran utama):`,
    system_prompt || '(Belum ada informasi khusus diisi oleh pemilik toko.)',
    `Aturan penting:`,
    `- Jangan mengarang informasi (harga, stok, alamat) yang tidak ada di atas. Kalau tidak tahu, katakan akan diteruskan ke admin.`,
    `- Jangan membahas topik di luar bisnis ini.`,
    `- Jawaban singkat dan jelas, cocok dibaca lewat chat/WhatsApp.`,
    greeting ? `Pesan sapaan pertama yang biasa dipakai: "${greeting}"` : ''
  ].filter(Boolean).join('\n');
}

module.exports = { askGroq, buildSystemPrompt };
