const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/* ─────────  ENCRYPTION  ───────── */
function getKey() {
  const raw = (process.env.ENCRYPTION_KEY || '').trim();
  if (raw.length === 64) { try { return Buffer.from(raw, 'hex'); } catch (_) {} }
  return crypto.createHash('sha256').update(process.env.BOT_TOKEN || 'veyro').digest();
}
function encrypt(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}
function decrypt(payload) {
  if (!payload?.startsWith?.('v1:')) return null;
  try {
    const [, ivHex, tagHex, dataHex] = payload.split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    d.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]).toString('utf8');
  } catch { return null; }
}

/* ─────────  STORE  ───────── */
class Store {
  constructor(file, fallback = {}) { this.file = file; this.fallback = fallback; this.data = null; this.q = Promise.resolve(); }
  async load() {
    if (this.data) return;
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const raw = await fs.readFile(this.file, 'utf8');
      this.data = raw.trim() ? JSON.parse(raw) : JSON.parse(JSON.stringify(this.fallback));
    } catch (e) {
      if (e.code === 'ENOENT' || e instanceof SyntaxError) {
        if (e instanceof SyntaxError) try { await fs.rename(this.file, `${this.file}.corrupt.${Date.now()}`); } catch (_) {}
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
  mutate(fn) { this.q = this.q.then(async () => { await this.load(); const r = await fn(this.data); await this.flush(); return r; }); return this.q; }
}

let users, gmail, channels;

async function init(dir) {
  let target = dir;
  if (target === '/data' || target.startsWith('/data/')) target = path.join(process.cwd(), 'data');
  try { await fs.mkdir(target, { recursive: true }); await fs.access(target, fs.constants.W_OK); }
  catch (e) { target = path.join(process.cwd(), 'data'); await fs.mkdir(target, { recursive: true }); }
  users = new Store(path.join(target, 'users.json'), {});
  gmail = new Store(path.join(target, 'gmail.json'), {});
  channels = new Store(path.join(target, 'channels.json'), { list: [] });
  await Promise.all([users.load(), gmail.load(), channels.load()]);
  console.log(`[STORE] ${target}`);
}

/* ─────────  USERS  ───────── */
async function getUser(id) { return users.read(d => d[String(id)] || null); }
async function upsertUser(tg) {
  const id = String(tg.id);
  return users.mutate(d => {
    const now = Date.now();
    if (d[id]) { Object.assign(d[id], { username: tg.username || d[id].username || '', firstName: tg.first_name || d[id].firstName || '', updatedAt: now }); return d[id]; }
    d[id] = { id: tg.id, username: tg.username || '', firstName: tg.first_name || '', pinHash: null, pinEnabled: false, pinAttempts: 0, pinLockedUntil: 0, createdAt: now, updatedAt: now };
    return d[id];
  });
}
async function updateUser(id, patch) {
  return users.mutate(d => { const u = d[String(id)]; if (!u) return null; Object.assign(u, patch, { updatedAt: Date.now() }); return u; });
}
async function listAllUserIds() { return users.read(d => Object.values(d).map(u => u.id)); }
async function countUsers() { return users.read(d => Object.keys(d).length); }

/* ─────────  GMAIL  ───────── */
const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
function validGmail(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (t.length < 11 || t.length > 254) return false;
  if (!GMAIL_RE.test(t)) return false;
  const local = t.split('@')[0];
  return local.length >= 6 && local.length <= 30 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
}
function validPassword(s) { return typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= 200; }
const normGmail = (s) => String(s).trim().toLowerCase();
const toEntry = (e) => typeof e === 'string' ? { email: e, passwordEnc: null, createdAt: null } : { email: e.email, passwordEnc: e.passwordEnc || null, createdAt: e.createdAt || null };

async function listGmails(id) { return gmail.read(d => Array.isArray(d[String(id)]) ? d[String(id)].map(toEntry) : []); }
async function countGmails(id) { return gmail.read(d => Array.isArray(d[String(id)]) ? d[String(id)].length : 0); }
async function getGmail(id, idx) { return gmail.read(d => { const l = d[String(id)]; return Array.isArray(l) && l[idx] ? toEntry(l[idx]) : null; }); }
async function addGmail(id, email, password) {
  const n = normGmail(email);
  return gmail.mutate(d => {
    if (!Array.isArray(d[String(id)])) d[String(id)] = [];
    const list = d[String(id)].map(toEntry);
    if (list.some(e => e.email === n)) return { ok: false, reason: 'duplicate' };
    list.push({ email: n, passwordEnc: password ? encrypt(password) : null, createdAt: Date.now() });
    d[String(id)] = list;
    return { ok: true, email: n };
  });
}
async function deleteGmail(id, email) {
  const n = normGmail(email);
  return gmail.mutate(d => {
    const l = d[String(id)];
    if (!Array.isArray(l)) return { ok: false };
    const i = l.findIndex(e => toEntry(e).email === n);
    if (i === -1) return { ok: false };
    l.splice(i, 1);
    return { ok: true };
  });
}
function revealPassword(entry) { return entry?.passwordEnc ? decrypt(entry.passwordEnc) : null; }

/* ─────────  CHANNELS  ───────── */
async function listChannels() { return channels.read(d => Array.isArray(d.list) ? [...d.list] : []); }
async function countChannels() { return channels.read(d => Array.isArray(d.list) ? d.list.length : 0); }
async function addChannel(username, title) {
  const u = username.replace(/^@/, '').toLowerCase();
  return channels.mutate(d => {
    if (!Array.isArray(d.list)) d.list = [];
    if (d.list.some(c => c.username === u)) return { ok: false, reason: 'duplicate' };
    d.list.push({ username: u, title: title || u, addedAt: Date.now() });
    return { ok: true };
  });
}
async function removeChannel(username) {
  const u = String(username).replace(/^@/, '').toLowerCase();
  return channels.mutate(d => {
    if (!Array.isArray(d.list)) return { ok: false };
    const i = d.list.findIndex(c => c.username === u);
    if (i === -1) return { ok: false };
    d.list.splice(i, 1);
    return { ok: true };
  });
}

/* ─────────  PIN  ───────── */
const MAX_ATTEMPTS = 5, LOCK_MS = 5 * 60 * 1000;
function validPin(pin, min, max) { return typeof pin === 'string' && /^\d+$/.test(pin) && pin.length >= min && pin.length <= max; }
async function setPin(id, pin) {
  const hash = await bcrypt.hash(pin, 10);
  return updateUser(id, { pinHash: hash, pinEnabled: true, pinAttempts: 0, pinLockedUntil: 0 });
}
async function verifyPin(id, pin) {
  const u = await getUser(id);
  if (!u?.pinEnabled || !u.pinHash) return { ok: false, reason: 'not_enabled' };
  if (u.pinLockedUntil && Date.now() < u.pinLockedUntil) return { ok: false, reason: 'locked', remaining: Math.ceil((u.pinLockedUntil - Date.now()) / 1000) };
  if (await bcrypt.compare(pin, u.pinHash)) { await updateUser(id, { pinAttempts: 0, pinLockedUntil: 0 }); return { ok: true }; }
  const attempts = (u.pinAttempts || 0) + 1;
  const locked = attempts >= MAX_ATTEMPTS;
  await updateUser(id, { pinAttempts: locked ? 0 : attempts, pinLockedUntil: locked ? Date.now() + LOCK_MS : u.pinLockedUntil || 0 });
  return { ok: false, reason: 'mismatch' };
}
async function disablePin(id) { return updateUser(id, { pinEnabled: false, pinHash: null, pinAttempts: 0, pinLockedUntil: 0 }); }

module.exports = {
  init, encrypt, decrypt,
  getUser, upsertUser, updateUser, listAllUserIds, countUsers,
  validGmail, validPassword, normGmail,
  listGmails, countGmails, getGmail, addGmail, deleteGmail, revealPassword,
  listChannels, countChannels, addChannel, removeChannel,
  validPin, setPin, verifyPin, disablePin,
};
