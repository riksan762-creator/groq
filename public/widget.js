/*!
 * Kilat Chat Widget
 * Cara pakai di website mana pun:
 * <script src="https://api-kamu.com/widget.js" data-key="WIDGET_KEY_KAMU"></script>
 */
(function () {
  var scriptTag = document.currentScript;
  var WIDGET_KEY = scriptTag.getAttribute('data-key');
  var API_BASE = scriptTag.src.replace(/\/widget\.js.*$/, '');
  var ACCENT = scriptTag.getAttribute('data-accent') || '#FFC933';
  var INK = '#14213D';

  if (!WIDGET_KEY) {
    console.warn('[Kilat] data-key tidak ditemukan pada <script> widget.');
    return;
  }

  var sessionKey = 'kilat_session_' + WIDGET_KEY;
  var sessionId = localStorage.getItem(sessionKey);

  var css = ''
    + '.kilat-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;'
    + 'background:' + INK + ';box-shadow:0 8px 24px rgba(20,33,61,.35);border:none;cursor:pointer;'
    + 'z-index:999999;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}'
    + '.kilat-btn:hover{transform:scale(1.06);}'
    + '.kilat-btn svg{width:26px;height:26px;}'
    + '.kilat-panel{position:fixed;bottom:92px;right:20px;width:340px;max-width:92vw;height:460px;max-height:70vh;'
    + 'background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(20,33,61,.28);display:none;flex-direction:column;'
    + 'overflow:hidden;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}'
    + '.kilat-panel.open{display:flex;}'
    + '.kilat-head{background:' + INK + ';color:#fff;padding:14px 16px;font-size:14px;font-weight:600;'
    + 'display:flex;align-items:center;justify-content:space-between;}'
    + '.kilat-head span.dot{width:8px;height:8px;border-radius:50%;background:#2FBF71;display:inline-block;margin-right:6px;}'
    + '.kilat-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:.8;line-height:1;}'
    + '.kilat-body{flex:1;overflow-y:auto;padding:14px;background:#F4F6F9;display:flex;flex-direction:column;gap:8px;}'
    + '.kilat-msg{max-width:80%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;}'
    + '.kilat-msg.bot{background:#fff;color:' + INK + ';align-self:flex-start;border-bottom-left-radius:3px;'
    + 'box-shadow:0 1px 3px rgba(0,0,0,.08);}'
    + '.kilat-msg.user{background:' + ACCENT + ';color:' + INK + ';align-self:flex-end;border-bottom-right-radius:3px;font-weight:500;}'
    + '.kilat-msg.typing{background:#fff;color:#9aa1b0;align-self:flex-start;}'
    + '.kilat-inputbar{display:flex;border-top:1px solid #eceef2;padding:8px;gap:6px;background:#fff;}'
    + '.kilat-inputbar input{flex:1;border:1px solid #e2e5ec;border-radius:10px;padding:9px 11px;font-size:13.5px;outline:none;}'
    + '.kilat-inputbar input:focus{border-color:' + ACCENT + ';}'
    + '.kilat-inputbar button{background:' + INK + ';color:#fff;border:none;border-radius:10px;padding:0 14px;font-size:13px;cursor:pointer;font-weight:600;}'
    + '.kilat-badge{text-align:center;font-size:10px;color:#aab0bd;padding:6px 0 2px;background:#fff;}'
    + '.kilat-badge a{color:#aab0bd;text-decoration:none;}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var btn = document.createElement('button');
  btn.className = 'kilat-btn';
  btn.setAttribute('aria-label', 'Buka chat');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'kilat-panel';
  panel.innerHTML =
    '<div class="kilat-head"><div><span class="dot"></span><span class="kilat-title">Chat</span></div>' +
    '<button class="kilat-close" aria-label="Tutup">&times;</button></div>' +
    '<div class="kilat-body"></div>' +
    '<div class="kilat-inputbar"><input type="text" placeholder="Tulis pesan..." /><button>Kirim</button></div>' +
    '<div class="kilat-badge">Ditenagai oleh <a href="#" target="_blank" rel="noopener">Kilat</a></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var body = panel.querySelector('.kilat-body');
  var input = panel.querySelector('input');
  var sendBtn = panel.querySelector('.kilat-inputbar button');
  var titleEl = panel.querySelector('.kilat-title');
  var closeBtn = panel.querySelector('.kilat-close');

  var opened = false;
  var greeted = false;

  function addMsg(text, who) {
    var el = document.createElement('div');
    el.className = 'kilat-msg ' + who;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function toggle() {
    opened = !opened;
    panel.classList.toggle('open', opened);
    if (opened && !greeted) {
      greeted = true;
      fetch(API_BASE + '/api/widget-info/' + WIDGET_KEY)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.success) {
            titleEl.textContent = d.business_name;
            addMsg(d.greeting, 'bot');
          }
        })
        .catch(function () { addMsg('Halo! Ada yang bisa dibantu?', 'bot'); });
    }
  }

  btn.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');

    var typingEl = addMsg('Mengetik...', 'typing');

    fetch(API_BASE + '/api/chat/' + WIDGET_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typingEl.remove();
        if (d.session_id) {
          sessionId = d.session_id;
          localStorage.setItem(sessionKey, sessionId);
        }
        addMsg(d.success ? d.reply : (d.message || 'Maaf, terjadi kendala.'), 'bot');
      })
      .catch(function () {
        typingEl.remove();
        addMsg('Koneksi bermasalah, coba lagi ya.', 'bot');
      });
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') send();
  });
})();
