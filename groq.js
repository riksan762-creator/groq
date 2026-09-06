const fetch = require('node-fetch');
const config = require('./config');

const DEFAULT_PROMPT = `Kamu adalah asisten marketing khusus UMKM Indonesia yang jago bikin konten jualan yang laris.
Berdasarkan info produk berikut, buatkan konten jualan yang siap pakai.

Nama produk: {productName}
Kategori: {category}
Harga: {price}
Keunggulan/detail tambahan: {features}

Balas HANYA dalam format JSON valid seperti ini, tanpa teks lain, tanpa markdown code fence:
{
  "caption_ig": "caption untuk Instagram, gaya santai dan relatable, boleh pakai emoji secukupnya, diakhiri call-to-action",
  "caption_tiktok": "caption untuk TikTok, lebih singkat dan catchy, hook di kalimat pertama",
  "hashtags": ["#tag1", "#tag2", "... 8-12 hashtag relevan, campuran hashtag niche dan hashtag umum"],
  "deskripsi_marketplace": "deskripsi produk untuk Shopee/Tokopedia, terstruktur, jelas, mencantumkan keunggulan dan detail, cocok untuk SEO marketplace"
}`;

async function callGroq(messages, { model, maxTokens = 900, jsonMode = false } = {}) {
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY belum diset di .env');
  }
  const res = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groq.apiKey}`,
    },
    body: JSON.stringify({
      model: model || config.groq.textModel,
      messages,
      max_tokens: maxTokens,
      temperature: 0.8,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Generate konten jualan dari data produk. Kalau photoBase64 dikasih,
 * pakai model vision supaya AI ikut "melihat" foto produk sebagai konteks.
 */
async function generateCaption({ productName, category, price, features, photoBase64 }) {
  const promptTemplate = require('./db').data.settings.promptTemplate || DEFAULT_PROMPT;
  const prompt = promptTemplate
    .replace('{productName}', productName || '-')
    .replace('{category}', category || '-')
    .replace('{price}', price || '-')
    .replace('{features}', features || '-');

  let content;
  if (photoBase64) {
    content = await callGroq(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
          ],
        },
      ],
      { model: config.groq.visionModel, jsonMode: true }
    );
  } else {
    content = await callGroq([{ role: 'user', content: prompt }], { jsonMode: true });
  }

  try {
    return JSON.parse(content);
  } catch {
    // fallback kalau model tidak strict JSON — bungkus mentah supaya tidak error total
    return {
      caption_ig: content,
      caption_tiktok: '',
      hashtags: [],
      deskripsi_marketplace: '',
    };
  }
}

/**
 * Chat tanya-jawab bebas untuk widget "coba AI" di landing page (demo publik, dibatasi rate limit).
 */
async function trialChat(history) {
  const messages = [
    {
      role: 'system',
      content:
        'Kamu adalah asisten demo untuk menunjukkan kecepatan AI Groq di website KontenKilat. Jawab singkat, ramah, dan dalam Bahasa Indonesia. Kalau relevan, arahkan halus ke fitur generate caption produk.',
    },
    ...history,
  ];
  return callGroq(messages, { maxTokens: 400 });
}

module.exports = { generateCaption, trialChat };
