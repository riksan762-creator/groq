const state = {
  token: localStorage.getItem('kk_token') || null,
  user: null,
  authMode: 'login',
  trialHistory: [],
};

const api = (path, opts = {}) =>
  fetch(path, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...opts.headers,
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Terjadi kesalahan');
    return data;
  });

// ---------- demo typewriter on hero ----------
const DEMO_CAPTION = 'Ngopi santai sambil rebahan? ☕ Kopi Susu Gula Aren kami bikin sore-mu makin manis. Gula aren asli, tanpa pengawet — dijamin nagih! Order sekarang sebelum kehabisan 😉';
const DEMO_TAGS = ['#kopisusu', '#gulaaren', '#kulinerlokal', '#umkmindonesia', '#kopikekinian'];

function typewriter(el, text, speed = 18) {
  let i = 0;
  el.innerHTML = '';
  const span = document.createElement('span');
  el.appendChild(span);
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  el.appendChild(cursor);
  const tick = () => {
    span.textContent = text.slice(0, i);
    i++;
    if (i <= text.length) setTimeout(tick, speed);
    else cursor.remove();
  };
  tick();
}

window.addEventListener('DOMContentLoaded', () => {
  typewriter(document.getElementById('demoCaption'), DEMO_CAPTION);
  const tagsEl = document.getElementById('demoTags');
  DEMO_TAGS.forEach((t) => {
    const span = document.createElement('span');
    span.textContent = t;
    tagsEl.appendChild(span);
  });

  if (state.token) refreshMe();
  loadPackages();
});

// ---------- auth ----------
const authModal = document.getElementById('authModal');
document.getElementById('btnLogin').onclick = () => openAuth('login');
document.getElementById('btnRegister').onclick = () => openAuth('register');
document.getElementById('tabLogin').onclick = () => switchTab('login');
document.getElementById('tabRegister').onclick = () => switchTab('register');

function openAuth(mode) {
  switchTab(mode);
  authModal.classList.add('open');
}
function switchTab(mode) {
  state.authMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('nameField').style.display = mode === 'register' ? 'block' : 'none';
}
authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.classList.remove('open'); });

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  try {
    const path = state.authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('kk_token', data.token);
    authModal.classList.remove('open');
    updateCreditUI();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

async function refreshMe() {
  try {
    const data = await api('/api/me');
    state.user = data.user;
    updateCreditUI();
  } catch {
    state.token = null;
    localStorage.removeItem('kk_token');
  }
}

function updateCreditUI() {
  document.getElementById('creditCount').textContent = state.user ? state.user.credits : '0';
}

// ---------- generator ----------
document.getElementById('genForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.token) { openAuth('login'); return; }
  const btn = document.getElementById('btnGenerate');
  btn.disabled = true;
  btn.textContent = 'Sedang generate...';

  const form = new FormData(e.target);
  try {
    const data = await api('/api/generate', { method: 'POST', body: form });
    renderResult(data.output);
    state.user.credits = data.creditsLeft;
    updateCreditUI();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Konten (1 kredit)';
  }
});

function renderResult(output) {
  const area = document.getElementById('resultArea');
  const block = (title, content) => `
    <div class="result-block">
      <h4>${title}</h4>
      <p>${content}</p>
      <button class="btn-ghost copy-btn" onclick="navigator.clipboard.writeText(\`${(content || '').replace(/`/g, "'")}\`)">Salin</button>
    </div>`;
  area.innerHTML =
    block('Caption Instagram', output.caption_ig) +
    block('Caption TikTok', output.caption_tiktok) +
    block('Hashtag', (output.hashtags || []).join(' ')) +
    block('Deskripsi Marketplace', output.deskripsi_marketplace);
}

// ---------- trial chat ----------
document.getElementById('btnTrialSend').onclick = sendTrial;
document.getElementById('trialInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendTrial(); });

async function sendTrial() {
  const input = document.getElementById('trialInput');
  const text = input.value.trim();
  if (!text) return;
  const log = document.getElementById('trialLog');

  addMsg(log, 'user', text);
  state.trialHistory.push({ role: 'user', content: text });
  input.value = '';

  try {
    const data = await api('/api/trial-chat', { method: 'POST', body: JSON.stringify({ history: state.trialHistory }) });
    addMsg(log, 'ai', data.reply);
    state.trialHistory.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    addMsg(log, 'ai', err.message);
  }
}
function addMsg(log, role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------- top up ----------
document.getElementById('btnTopup').onclick = () => {
  document.getElementById('packagesPanel').style.display = 'block';
  document.getElementById('packagesPanel').scrollIntoView({ behavior: 'smooth' });
};

async function loadPackages() {
  const data = await api('/api/packages');
  const grid = document.getElementById('packagesGrid');
  grid.innerHTML = '';
  data.packages.forEach((p) => {
    const card = document.createElement('button');
    card.className = 'package-card';
    card.innerHTML = `<b>${p.credits} kredit</b><span>Rp${p.priceRp.toLocaleString('id-ID')}</span>`;
    card.onclick = () => startTopup(p.credits);
    grid.appendChild(card);
  });
}

async function startTopup(credits) {
  if (!state.token) { openAuth('login'); return; }
  const qrisArea = document.getElementById('qrisArea');
  qrisArea.innerHTML = 'Membuat QRIS...';
  try {
    const data = await api('/api/topup', { method: 'POST', body: JSON.stringify({ credits }) });
    qrisArea.innerHTML = `
      <div class="result-block" style="text-align:center;">
        <img src="${data.qrUrl}" alt="QRIS" style="max-width:220px; border-radius:12px;" />
        <p style="margin-top:12px;">Scan pakai GoPay / e-wallet apapun yang support QRIS. Kredit masuk otomatis setelah bayar.</p>
        ${data.checkoutUrl ? `<a class="btn-primary" href="${data.checkoutUrl}" target="_blank" style="display:inline-block; margin-top:10px;">Buka halaman bayar</a>` : ''}
      </div>`;
  } catch (err) {
    qrisArea.innerHTML = `<p style="color:var(--coral)">${err.message}</p>`;
  }
}
