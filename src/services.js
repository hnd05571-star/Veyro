const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function getKey() {
  const raw = (process.env.ENCRYPTION_KEY || '').trim();
  if (raw.length === 64) { try { return Buffer.from(raw, 'hex'); } catch (_) {} }
  return crypto.createHash('sha256').update(process.env.BOT_TOKEN || 'veyro').digest();
}
function encrypt(plain) {
  const key = getKey(); const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `v1:${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}
function decrypt(p) {
  if (!p?.startsWith?.('v1:')) return null;
  try {
    const [, ivHex, tagHex, dHex] = p.split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    d.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([d.update(Buffer.from(dHex, 'hex')), d.final()]).toString('utf8');
  } catch { return null; }
}

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
        this.data = JSON.parse(JSON.stringify(this.fallback)); await this.flush();
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

let users, channels, withdrawals, activity;

async function init(dir) {
  let target = dir;
  if (target === '/data' || target.startsWith('/data/')) target = path.join(process.cwd(), 'data');
  try { await fs.mkdir(target, { recursive: true }); await fs.access(target, fs.constants.W_OK); }
  catch (e) { target = path.join(process.cwd(), 'data'); await fs.mkdir(target, { recursive: true }); }
  users = new Store(path.join(target, 'users.json'), {});
  channels = new Store(path.join(target, 'channels.json'), { list: [] });
  withdrawals = new Store(path.join(target, 'withdrawals.json'), { list: [] });
  activity = new Store(path.join(target, 'activity.json'), { list: [] });
  await Promise.all([users.load(), channels.load(), withdrawals.load(), activity.load()]);
  console.log(`[STORE] ${target}`);
}

/* ─────────  USERS  ───────── */
const REFERRAL_REWARD = 2;
const PREMIUM_COST = 100;
const PREMIUM_DAYS = 30;
const WITHDRAW_MIN = 50;

async function getUser(id) { return users.read(d => d[String(id)] || null); }

async function upsertUser(tg) {
  const id = String(tg.id);
  return users.mutate(d => {
    const now = Date.now();
    if (d[id]) {
      Object.assign(d[id], {
        username: tg.username || d[id].username || '',
        firstName: tg.first_name || d[id].firstName || '',
        updatedAt: now,
      });
      return d[id];
    }
    d[id] = {
      id: tg.id, username: tg.username || '', firstName: tg.first_name || '',
      pinHash: null, pinEnabled: false, pinAttempts: 0, pinLockedUntil: 0,
      stars: 0, referrals: 0, referredBy: null, premiumUntil: 0,
      createdAt: now, updatedAt: now,
    };
    return d[id];
  });
}
async function updateUser(id, patch) {
  return users.mutate(d => { const u = d[String(id)]; if (!u) return null; Object.assign(u, patch, { updatedAt: Date.now() }); return u; });
}
async function listAllUserIds() { return users.read(d => Object.values(d).map(u => u.id)); }
async function countUsers() { return users.read(d => Object.keys(d).length); }
async function listAllUsers() { return users.read(d => Object.values(d)); }

async function totalStarsDistributed() {
  return users.read(d => Object.values(d).reduce((sum, u) => sum + (u.stars || 0), 0));
}
async function totalReferrals() {
  return users.read(d => Object.values(d).reduce((sum, u) => sum + (u.referrals || 0), 0));
}
async function topReferrers(limit = 10) {
  return users.read(d => Object.values(d)
    .filter(u => (u.referrals || 0) > 0)
    .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
    .slice(0, limit)
    .map(u => ({ id: u.id, username: u.username, firstName: u.firstName, referrals: u.referrals, stars: u.stars || 0 })));
}
async function premiumCount() {
  const now = Date.now();
  return users.read(d => Object.values(d).filter(u => (u.premiumUntil || 0) > now).length);
}

/* ─────────  STARS  ───────── */
async function addStars(id, amount) {
  return users.mutate(d => {
    const u = d[String(id)]; if (!u) return null;
    u.stars = (u.stars || 0) + Number(amount);
    u.updatedAt = Date.now();
    return u.stars;
  });
}
async function getStars(id) { const u = await getUser(id); return u?.stars || 0; }

/* ─────────  REFERRAL  ───────── */
async function applyReferral(newUserId, referrerId) {
  const newId = String(newUserId), refId = String(referrerId);
  if (newId === refId) return { ok: false, reason: 'self' };
  return users.mutate(d => {
    const ref = d[refId]; const nw = d[newId];
    if (!ref || !nw) return { ok: false, reason: 'missing' };
    if (nw.referredBy) return { ok: false, reason: 'already' };
    nw.referredBy = refId;
    ref.referrals = (ref.referrals || 0) + 1;
    ref.stars = (ref.stars || 0) + REFERRAL_REWARD;
    ref.updatedAt = Date.now(); nw.updatedAt = Date.now();
    return { ok: true, reward: REFERRAL_REWARD };
  });
}

/* ─────────  PREMIUM  ───────── */
async function buyPremium(id) {
  const u = await getUser(id);
  if (!u) return { ok: false, reason: 'no_user' };
  if ((u.stars || 0) < PREMIUM_COST) return { ok: false, reason: 'insufficient', stars: u.stars || 0 };
  return users.mutate(d => {
    const u2 = d[String(id)];
    u2.stars -= PREMIUM_COST;
    const base = Math.max(Date.now(), u2.premiumUntil || 0);
    u2.premiumUntil = base + PREMIUM_DAYS * 24 * 60 * 60 * 1000;
    u2.updatedAt = Date.now();
    return { ok: true, premiumUntil: u2.premiumUntil, stars: u2.stars };
  });
}
function isPremium(u) { return u?.premiumUntil > Date.now(); }

/* ─────────  WITHDRAWALS  ───────── */
async function createWithdrawal(userId, amount, method, details) {
  return withdrawals.mutate(d => {
    if (!Array.isArray(d.list)) d.list = [];
    const id = String(Date.now()).slice(-6);
    const item = { id, userId: String(userId), amount: Number(amount), method, details, status: 'pending', createdAt: Date.now() };
    d.list.push(item);
    return item;
  });
}
async function listWithdrawalsByUser(userId) {
  return withdrawals.read(d => (d.list || []).filter(w => w.userId === String(userId)).sort((a, b) => b.createdAt - a.createdAt));
}
async function listPendingWithdrawals() {
  return withdrawals.read(d => (d.list || []).filter(w => w.status === 'pending').sort((a, b) => a.createdAt - b.createdAt));
}
async function countPendingWithdrawals() {
  return withdrawals.read(d => (d.list || []).filter(w => w.status === 'pending').length);
}
async function getWithdrawal(id) {
  return withdrawals.read(d => (d.list || []).find(w => w.id === String(id)) || null);
}
async function updateWithdrawal(id, status) {
  return withdrawals.mutate(d => {
    const w = (d.list || []).find(x => x.id === String(id));
    if (!w || w.status !== 'pending') return null;
    w.status = status; w.reviewedAt = Date.now();
    return w;
  });
}

/* ─────────  CHANNELS  ───────── */
async function listChannels() { return channels.read(d => Array.isArray(d.list) ? [...d.list] : []); }
async function countChannels() { return channels.read(d => Array.isArray(d.list) ? d.list.length : 0); }

function parseChannelInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  // private invite
  let m = s.match(/(?:https?:\/\/)?t\.me\/\+([a-zA-Z0-9_-]+)/i);
  if (m) return { username: `+${m[1]}`, isPrivate: true };
  // public link
  m = s.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/i);
  if (m) return { username: m[1], isPrivate: false };
  // bare @user or user
  m = s.match(/^@?([a-zA-Z0-9_]{3,64})$/);
  if (m) return { username: m[1], isPrivate: false };
  return null;
}

async function addChannel(username, title, isPrivate) {
  return channels.mutate(d => {
    if (!Array.isArray(d.list)) d.list = [];
    if (d.list.some(c => c.username.toLowerCase() === username.toLowerCase())) return { ok: false, reason: 'duplicate' };
    d.list.push({ username, title: title || username, isPrivate: !!isPrivate, addedAt: Date.now() });
    return { ok: true };
  });
}
async function removeChannel(username) {
  const u = String(username).replace(/^@/, '').toLowerCase();
  return channels.mutate(d => {
    if (!Array.isArray(d.list)) return { ok: false };
    const i = d.list.findIndex(c => c.username.toLowerCase() === u || c.username.toLowerCase() === `+${u}`);
    if (i === -1) return { ok: false };
    d.list.splice(i, 1); return { ok: true };
  });
}

/* ─────────  ACTIVITY  ───────── */
async function logActivity(type, text) {
  return activity.mutate(d => {
    if (!Array.isArray(d.list)) d.list = [];
    d.list.push({ type, text, at: Date.now() });
    if (d.list.length > 50) d.list = d.list.slice(-50);
    return true;
  });
}
async function recentActivity(limit = 15) {
  return activity.read(d => (d.list || []).slice(-limit).reverse());
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
  REFERRAL_REWARD, PREMIUM_COST, PREMIUM_DAYS, WITHDRAW_MIN,
  getUser, upsertUser, updateUser, listAllUserIds, listAllUsers, countUsers,
  totalStarsDistributed, totalReferrals, topReferrers, premiumCount,
  addStars, getStars,
  applyReferral,
  buyPremium, isPremium,
  createWithdrawal, listWithdrawalsByUser, listPendingWithdrawals,
  countPendingWithdrawals, getWithdrawal, updateWithdrawal,
  listChannels, countChannels, addChannel, removeChannel, parseChannelInput,
  logActivity, recentActivity,
  validPin, setPin, verifyPin, disablePin,
};
