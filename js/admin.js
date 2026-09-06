let adminPassword = sessionStorage.getItem('kk_admin_pw') || null;

const adminApi = (path, opts = {}) =>
  fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword,
      ...opts.headers,
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Terjadi kesalahan');
    return data;
  });

document.getElementById('btnAdminLogin').onclick = async () => {
  adminPassword = document.getElementById('adminPasswordInput').value;
  try {
    await adminApi('/api/admin/stats');
    sessionStorage.setItem('kk_admin_pw', adminPassword);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    initApp();
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
  }
};

if (adminPassword) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  initApp();
}

function initApp() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.onclick = () => {
      document.querySelectorAll('.nav-item').forEach((i) => i.classList.remove('active'));
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`section-${item.dataset.section}`).classList.add('active');
    };
  });
  loadStats();
  loadUsers();
  loadTransactions();
  loadSettings();
}

async function loadStats() {
  const data = await adminApi('/api/admin/stats');
  const row = document.getElementById('statRow');
  const items = [
    ['Total Pengguna', data.totalUsers],
    ['Total Generate', data.totalGenerations],
    ['Transaksi Lunas', data.totalTransactionsPaid],
    ['Total Pendapatan', `Rp${data.totalRevenue.toLocaleString('id-ID')}`],
  ];
  row.innerHTML = items.map(([label, value]) => `
    <div class="stat-card"><div class="label">${label}</div><div class="value">${value}</div></div>
  `).join('');
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.row-actions')) closeAllDropdowns();
});

async function loadUsers() {
  const data = await adminApi('/api/admin/users');
  const body = document.getElementById('usersBody');
  body.innerHTML = data.users.map((u) => `
    <tr>
      <td>${u.name}</td>
      <td>${u.wa}</td>
      <td>${u.credits}</td>
      <td><span class="badge ${u.suspended ? 'suspended' : 'active'}">${u.suspended ? 'Nonaktif' : 'Aktif'}</span></td>
      <td class="row-actions">
        <button class="ellipsis-btn" data-id="${u.id}">⋯</button>
        <div class="dropdown" id="dd-user-${u.id}">
          <button onclick="editCredit('${u.id}', ${u.credits})">Ubah kredit</button>
          <button onclick="toggleSuspend('${u.id}', ${u.suspended})">${u.suspended ? 'Aktifkan' : 'Nonaktifkan'}</button>
          <button class="danger" onclick="deleteUser('${u.id}')">Hapus akun</button>
        </div>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.ellipsis-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const dd = document.getElementById(`dd-user-${btn.dataset.id}`);
      const isOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) dd.classList.add('open');
    };
  });
}

async function editCredit(id, current) {
  const val = prompt('Set jumlah kredit baru:', current);
  if (val === null) return;
  await adminApi(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ credits: parseInt(val, 10) }) });
  loadUsers();
}
async function toggleSuspend(id, suspended) {
  await adminApi(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ suspended: !suspended }) });
  loadUsers();
}
async function deleteUser(id) {
  if (!confirm('Hapus akun ini permanen?')) return;
  await adminApi(`/api/admin/users/${id}`, { method: 'DELETE' });
  loadUsers();
}

async function loadTransactions() {
  const data = await adminApi('/api/admin/transactions');
  const body = document.getElementById('trxBody');
  body.innerHTML = data.transactions.map((t) => `
    <tr>
      <td>${t.userName}</td>
      <td>${t.packageCredits}</td>
      <td>Rp${t.priceRp.toLocaleString('id-ID')}</td>
      <td><span class="badge ${t.status === 'paid' ? 'paid' : 'pending'}">${t.status === 'paid' ? 'Lunas' : 'Menunggu'}</span></td>
      <td>${new Date(t.createdAt).toLocaleString('id-ID')}</td>
      <td class="row-actions">
        <button class="ellipsis-btn" data-id="${t.id}">⋯</button>
        <div class="dropdown" id="dd-trx-${t.id}">
          <button onclick="alert('Transaction ID: ${t.trxId || '-'}')">Lihat detail</button>
        </div>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.ellipsis-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const dd = document.getElementById(`dd-trx-${btn.dataset.id}`);
      const isOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) dd.classList.add('open');
    };
  });
}

async function loadSettings() {
  const data = await adminApi('/api/admin/settings');
  const pkgs = data.packages.map((p) => `${p.credits}:${p.priceRp}`).join('\n');
  document.getElementById('packagesInput').value = pkgs;
  document.getElementById('promptInput').value = data.promptTemplate || '';
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lines = document.getElementById('packagesInput').value.trim().split('\n').filter(Boolean);
  const packages = lines.map((l) => {
    const [credits, priceRp] = l.split(':').map((x) => parseInt(x.trim(), 10));
    return { credits, priceRp };
  });
  const promptTemplate = document.getElementById('promptInput').value.trim() || null;
  await adminApi('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ packages, promptTemplate }) });
  alert('Pengaturan disimpan');
});
