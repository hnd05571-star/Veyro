const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function getKey() {
  const raw = (process.env.ENCRYPTION_KEY || '').trim();
  if (raw.length === 64) { try { return Buffer.from(raw, 'hex'); } catch (_) {} }
  return crypto.createHash('sha256').update(process.env.BOT_TOKEN || 'veyro').digest();
}
function encrypt(p) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([c.update(String(p), 'utf8'), c.final()]);
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

let users, channels, withdrawals, starReqs, activity;

/* ─────────  SHOP CONFIG  ───────── */
const STAR_PACKS = [
  { id: 20,  price: 20,  get: 17 },
  { id: 40,  price: 40,  get: 35 },
  { id: 60,  price: 60,  get: 52 },
  { id: 80,  price: 80,  get: 70 },
  { id: 100, price: 100, get: 87 },
  { id: 120, price: 120, get: 105 },
  { id: 140, price: 140, get: 122 },
  { id: 160, price: 160, get: 140 },
  { id: 180, price: 180, get: 157 },
  { id: 200, price: 200, get: 175 },
];
const PREMIUM_PLANS = [
  { id: '1m',  label: '1 Month',  months: 1,  cost: 260 },
  { id: '3m',  label: '3 Months', months: 3,  cost: 750 },
  { id: '6m',  label: '6 Months', months: 6,  cost: 1050 },
  { id: '12m', label: '1 Year',   months: 12, cost: 1400 },
];
const REFERRAL_REWARD = 2;
const WITHDRAW_MIN = 50;

async function init(dir) {
  let target = dir;
  if (target === '/data' || target.startsWith('/data/')) target = path.join(process.cwd(), 'data');
  try { await fs.mkdir(target, { recursive: true }); await fs.access(target, fs.constants.W_OK); }
  catch (e) { target = path.join(process.cwd(), 'data'); await fs.mkdir(target, { recursive: true }); }
  users = new Store(path.join(target, 'users.json'), {});
  channels = new Store(path.join(target, 'channels.json'), { list: [] });
  withdrawals = new Store(path.join(target, 'withdrawals.json'), { list: [] });
  starReqs = new Store(path.join(target, 'star_requests.json'), { list: [] });
  activity = new Store(path.join(target, 'activity.json'), { list: [] });
  await Promise.all([users.load(), channels.load(), withdrawals.load(), starReqs.load(), activity.load()]);
  console.log(`[STORE] ${target}`);
}

/* ─────────  USERS  ───────── */
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
async function totalStarsDistributed() { return users.read(d => Object.values(d).reduce((s, u) => s + (u.stars || 0), 0)); }
async function totalReferrals() { return users.read(d => Object.values(d).reduce((s, u) => s + (u.referrals || 0), 0)); }
async function topReferrers(limit = 10) {
  return users.read(d => Object.values(d)
    .filter(u => (u.referrals || 0) > 0)
    .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
    .slice(0, limit)
    .map(u => ({ id: u.id, username: u.username, firstName: u.firstName, referrals: u.referrals, stars: u.stars || 0 })));
}
async function premiumCount() { const now = Date.now(); return users.read(d => Object.values(d).filter(u => (u.premiumUntil || 0) > now).length); }

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
async function buyPremiumPlan(id, planId) {
  const plan = PREMIUM_PLANS.find(p => p.id === planId);
  if (!plan) return { ok: false, reason: 'invalid_plan' };
  return users.mutate(d => {
    const u = d[String(id)]; if (!u) return { ok: false, reason: 'no_user' };
    if ((u.stars || 0) < plan.cost) return { ok: false, reason: 'insufficient', stars: u.stars || 0 };
    u.stars -= plan.cost;
    const base = Math.max(Date.now(), u.premiumUntil || 0);
    u.premiumUntil = base + plan.months * 30 * 24 * 60 * 60 * 1000;
    u.updatedAt = Date.now();
    return { ok: true, premiumUntil: u.premiumUntil, stars: u.stars, plan };
  });
}
function isPremium(u) { return u?.premiumUntil > Date.now(); }

/* ─────────  STAR REQUESTS (buy stars)  ───────── */
async function createStarRequest(userId, packId) {
  const pack = STAR_PACKS.find(p => p.id === packId);
  if (!pack) return null;
  return starReqs.mutate(d => {
    if (!Array.isArray(d.list)) d.list = [];
    const id = String(Date.now()).slice(-6);
    const item = { id, userId: String(userId), packId, price: pack.price, get: pack.get, status: 'pending', createdAt: Date.now() };
    d.list.push(item);
    return item;
  });
}
async function listPendingStarRequests() { return starReqs.read(d => (d.list || []).filter(x => x.status === 'pending').sort((a, b) => a.createdAt - b.createdAt)); }
async function countPendingStarRequests() { return starReqs.read(d => (d.list || []).filter(x => x.status === 'pending').length); }
async function getStarRequest(id) { return starReqs.read(d => (d.list || []).find(x => x.id === String(id)) || null); }
async function updateStarRequest(id, status) {
  return starReqs.mutate(d => {
    const w = (d.list || []).find(x => x.id === String(id));
    if (!w || w.status !== 'pending') return null;
    w.status = status; w.reviewedAt = Date.now();
    if (status === 'approved') {
      const u = d.users === undefined ? null : null; // users are in another store
    }
    return w;
  });
}

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
async function listWithdrawalsByUser(userId) { return withdrawals.read(d => (d.list || []).filter(w => w.userId === String(userId)).sort((a, b) => b.createdAt - a.createdAt)); }
async function listPendingWithdrawals() { return withdrawals.read(d => (d.list || []).filter(w => w.status === 'pending').sort((a, b) => a.createdAt - b.createdAt)); }
async function countPendingWithdrawals() { return withdrawals.read(d => (d.list || []).filter(w => w.status === 'pending').length); }
async function getWithdrawal(id) { return withdrawals.read(d => (d.list || []).find(w => w.id === String(id)) || null); }
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
  let m = s.match(/(?:https?:\/\/)?t\.me\/\+([a-zA-Z0-9_-]+)/i);
  if (m) return { username: `+${m[1]}`, isPrivate: true };
  m = s.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/i);
  if (m) return { username: m[1], isPrivate: false };
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
async function recentActivity(limit = 15) { return activity.read(d => (d.list || []).slice(-limit).reverse()); }

module.exports = {
  init, encrypt, decrypt,
  STAR_PACKS, PREMIUM_PLANS, REFERRAL_REWARD, WITHDRAW_MIN,
  getUser, upsertUser, updateUser, listAllUserIds, listAllUsers, countUsers,
  totalStarsDistributed, totalReferrals, topReferrers, premiumCount,
  addStars, getStars,
  applyReferral,
  buyPremiumPlan, isPremium,
  createStarRequest, listPendingStarRequests, countPendingStarRequests, getStarRequest, updateStarRequest,
  createWithdrawal, listWithdrawalsByUser, listPendingWithdrawals, countPendingWithdrawals, getWithdrawal, updateWithdrawal,
  listChannels, countChannels, addChannel, removeChannel, parseChannelInput,
  logActivity, recentActivity,
};
