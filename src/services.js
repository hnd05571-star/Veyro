const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

/* ─────────────────────────────────────────────────────────────
   JSON STORE — atomic + queued writes (no corruption)
   ───────────────────────────────────────────────────────────── */
class Store {
  constructor(file, fallback = {}) {
    this.file = file;
    this.fallback = fallback;
    this.data = null;
    this.q = Promise.resolve();
  }

  async load() {
    if (this.data) return;
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const raw = await fs.readFile(this.file, 'utf8');
      this.data = raw.trim() ? JSON.parse(raw) : JSON.parse(JSON.stringify(this.fallback));
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.data = JSON.parse(JSON.stringify(this.fallback));
        await this.flush();
      } else if (e instanceof SyntaxError) {
        try { await fs.rename(this.file, `${this.file}.corrupt.${Date.now()}`); } catch (_) {}
        this.data = JSON.parse(JSON.stringify(this.fallback));
        await this.flush();
      } else throw e;
    }
  }

  async flush() {
    const tmp = `${this.file}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }

  read(fn) { return this.load().then(() => fn(this.data)); }

  mutate(fn) {
    this.q = this.q.then(async () => {
      await this.load();
      const result = await fn(this.data);
      await this.flush();
      return result;
    });
    return this.q;
  }
}

let users, gmail;

/* ─────────────────────────────────────────────────────────────
   INIT — hard safety against /data permission issue
   ───────────────────────────────────────────────────────────── */
async function init(dir) {
  let target = dir;

  // Never allow /data root — not writable on Render free tier
  if (target === '/data' || target.startsWith('/data/')) {
    target = path.join(process.cwd(), 'data');
  }

  // Verify writable, else fall back to ./data
  try {
    await fs.mkdir(target, { recursive: true });
    await fs.access(target, fs.constants.W_OK);
  } catch (e) {
    const fallback = path.join(process.cwd(), 'data');
    console.warn(`[STORE] Cannot use "${target}" (${e.code}). Falling back to "${fallback}"`);
    target = fallback;
    await fs.mkdir(target, { recursive: true });
  }

  users = new Store(path.join(target, 'users.json'), {});
  gmail = new Store(path.join(target, 'gmail.json'), {});
  await Promise.all([users.load(), gmail.load()]);
  console.log(`[STORE] Using data dir: ${target}`);
}

/* ─────────────────────────────────────────────────────────────
   USERS
   ───────────────────────────────────────────────────────────── */
async function getUser(id) {
  return users.read((d) => d[String(id)] || null);
}

async function upsertUser(tg) {
  const id = String(tg.id);
  return users.mutate((d) => {
    const now = Date.now();
    if (d[id]) {
      d[id].username = tg.username || d[id].username || '';
      d[id].firstName = tg.first_name || d[id].firstName || '';
      d[id].updatedAt = now;
      return d[id];
    }
    d[id] = {
      id: tg.id,
      username: tg.username || '',
      firstName: tg.first_name || '',
      pinHash: null,
      pinEnabled: false,
      pinAttempts: 0,
      pinLockedUntil: 0,
      createdAt: now,
      updatedAt: now,
    };
    return d[id];
  });
}

async function updateUser(id, patch) {
  return users.mutate((d) => {
    const u = d[String(id)];
    if (!u) return null;
    Object.assign(u, patch, { updatedAt: Date.now() });
    return u;
  });
}

/* ─────────────────────────────────────────────────────────────
   GMAIL
   ───────────────────────────────────────────────────────────── */
const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

function validGmail(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (t.length < 11 || t.length > 254) return false;
  if (!GMAIL_RE.test(t)) return false;
  const local = t.split('@')[0];
  if (local.length < 6 || local.length > 30) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;
  return true;
}

const normGmail = (s) => String(s).trim().toLowerCase();

async function listGmails(id) {
  return gmail.read((d) => (Array.isArray(d[String(id)]) ? [...d[String(id)]] : []));
}

async function countGmails(id) {
  return gmail.read((d) => (Array.isArray(d[String(id)]) ? d[String(id)].length : 0));
}

async function getGmail(id, idx) {
  return gmail.read((d) => {
    const list = d[String(id)];
    return Array.isArray(list) ? list[idx] || null : null;
  });
}

async function addGmail(id, email) {
  const n = normGmail(email);
  return gmail.mutate((d) => {
    if (!Array.isArray(d[String(id)])) d[String(id)] = [];
    if (d[String(id)].includes(n)) return { ok: false, reason: 'duplicate' };
    d[String(id)].push(n);
    return { ok: true, email: n };
  });
}

async function deleteGmail(id, email) {
  const n = normGmail(email);
  return gmail.mutate((d) => {
    const l = d[String(id)];
    if (!Array.isArray(l)) return { ok: false };
    const i = l.indexOf(n);
    if (i === -1) return { ok: false };
    l.splice(i, 1);
    return { ok: true };
  });
}

/* ─────────────────────────────────────────────────────────────
   PIN
   ───────────────────────────────────────────────────────────── */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

function validPin(pin, min, max) {
  return typeof pin === 'string' && /^\d+$/.test(pin) && pin.length >= min && pin.length <= max;
}

async function setPin(id, pin) {
  const hash = await bcrypt.hash(pin, 10);
  return updateUser(id, {
    pinHash: hash,
    pinEnabled: true,
    pinAttempts: 0,
    pinLockedUntil: 0,
  });
}

async function verifyPin(id, pin) {
  const u = await getUser(id);
  if (!u || !u.pinEnabled || !u.pinHash) return { ok: false, reason: 'not_enabled' };

  if (u.pinLockedUntil && Date.now() < u.pinLockedUntil) {
    return {
      ok: false,
      reason: 'locked',
      remaining: Math.ceil((u.pinLockedUntil - Date.now()) / 1000),
    };
  }

  const match = await bcrypt.compare(pin, u.pinHash);
  if (match) {
    await updateUser(id, { pinAttempts: 0, pinLockedUntil: 0 });
    return { ok: true };
  }

  const attempts = (u.pinAttempts || 0) + 1;
  const locked = attempts >= MAX_ATTEMPTS;
  await updateUser(id, {
    pinAttempts: locked ? 0 : attempts,
    pinLockedUntil: locked ? Date.now() + LOCK_MS : u.pinLockedUntil || 0,
  });
  return { ok: false, reason: 'mismatch' };
}

async function disablePin(id) {
  return updateUser(id, {
    pinEnabled: false,
    pinHash: null,
    pinAttempts: 0,
    pinLockedUntil: 0,
  });
}

module.exports = {
  init,
  getUser, upsertUser, updateUser,
  validGmail, normGmail, listGmails, countGmails, getGmail, addGmail, deleteGmail,
  validPin, setPin, verifyPin, disablePin,
};
