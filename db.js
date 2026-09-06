const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function defaultData() {
  return {
    users: {},        // id -> { id, name, wa, passwordHash, credits, createdAt, suspended }
    transactions: {},  // id -> { id, userId, packageCredits, priceRp, status, trxId, qrUrl, checkoutUrl, createdAt, paidAt }
    generations: {},   // id -> { id, userId, productName, category, priceRp, features, output, createdAt }
    trialUsage: {},    // ip -> { date: 'YYYY-MM-DD', count }
    settings: {
      packages: null,  // null = pakai defaultPackages dari config.js
      promptTemplate: null, // null = pakai default bawaan di groq.js
    },
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

let cache = load();
let saveQueued = false;

function save() {
  if (saveQueued) return;
  saveQueued = true;
  setImmediate(() => {
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
    saveQueued = false;
  });
}

module.exports = {
  get data() {
    return cache;
  },
  save,
  reload() {
    cache = load();
  },
};
