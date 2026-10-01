const cfg = () => global.VEYRO;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ─────────  PER-KEY FIXED EMOJI  ───────── */
const KEY_NAMES = [
  'STAR','MAIL','SUCCESS','WARNING','ERROR','INFO','LOCK','KEY','USER','FOLDER',
  'CHECK','ROCKET','DIAMOND','GIFT','CROWN','SUPPORT','DOC','TRASH','REFRESH',
  'UNLOCK','SPARKLE','HEART','FIRE','PLUS','BACK','SECURITY','WELCOME',
];
const KEY_TO_ID = {};
const usedIds = new Set();
const badEmojiIds = new Set();
let emojisAssigned = false;

function assignEmojis() {
  if (emojisAssigned) return;
  emojisAssigned = true;
  const pool = [...(cfg().emojiPool || [])];
  const total = pool.length;
  if (!pool.length) { console.warn('[EMOJI] Empty pool'); return; }

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Assign unique IDs per key
  let idx = 0;
  for (const k of KEY_NAMES) {
    if (idx >= pool.length) idx = 0;
    KEY_TO_ID[k] = pool[idx++];
    usedIds.add(KEY_TO_ID[k]);
  }
  console.log(`[EMOJI] Pool: ${total} IDs · Assigned: ${Object.keys(KEY_TO_ID).length} keys`);
}

function e(key, fallback) {
  const c = cfg();
  if (!c.useCustomEmojis) return fallback;
  assignEmojis();
  const id = KEY_TO_ID[key];
  if (!id || badEmojiIds.has(id)) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

function stripCustomEmojis(t) { return String(t).replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/g, '$1'); }

/* Blacklist ALL failed IDs in the text and rebind their keys to fresh IDs */
function blacklistEmojisIn(t) {
  const ids = [...String(t).matchAll(/emoji-id="(\d+)"/g)].map(m => m[1]);
  if (!ids.length) return;
  const pool = (cfg().emojiPool || []).filter(id => !badEmojiIds.has(id));
  const failedKeys = [];

  ids.forEach(id => {
    badEmojiIds.add(id);
    // find which key used this id
    for (const k of Object.keys(KEY_TO_ID)) {
      if (KEY_TO_ID[k] === id) failedKeys.push(k);
    }
  });

  if (failedKeys.length) {
    console.warn(`[EMOJI] Failed IDs: ${ids.join(',')} → keys: ${failedKeys.join(',')}`);
  }

  // Rebinding: assign fresh IDs to failed keys
  let fi = 0;
  for (const k of failedKeys) {
    // find next unused working id
    while (fi < pool.length && usedIds.has(pool[fi])) fi++;
    if (fi < pool.length) {
      KEY_TO_ID[k] = pool[fi];
      usedIds.add(pool[fi]);
      fi++;
    } else {
      delete KEY_TO_ID[k];
    }
  }
}

function btn(text, data, style) {
  const b = { text, callback_data: data };
  if (style && cfg().buttonStyles) b.style = style;
  return b;
}
function urlBtn(text, url) { return { text, url }; }
const kb = (rows) => ({ inline_keyboard: rows });

const CB = {
  MAIN: 'm',
  PROFILE: 'pr', REFER: 'rf', STARS: 'st', PREMIUM: 'pm', WITHDRAW: 'wd', TOS: 'ts', SUP: 'sp',
  VERIFY: 'vfy',
  REF_COPY: 'rfc',
  STAR_PICK: (id) => `spk:${id}`,
  PM_PICK: (id) => `pmp:${id}`,
  PAY_PAID: (id) => `ppy:${id}`,
  PAY_CANCEL: (id) => `ppn:${id}`,
  WITHDRAW_REQUEST: 'wdr',
  ADMIN: 'adm',
  ADM_ADD: 'aa', ADM_LIST: 'al', ADM_REMOVE: 'ar',
  admRemove: (u) => `arx:${u}`, admRemoveOk: (u) => `aro:${u}`,
  ADM_BC: 'abc', ADM_WD: 'awd', ADM_SR: 'asr', ADM_GRANT: 'agr', ADM_PAY: 'apy',
  admW: (id) => `awx:${id}`, admWOk: (id) => `awo:${id}`, admWRj: (id) => `awr:${id}`,
  admS: (id) => `asx:${id}`, admSOk: (id) => `aso:${id}`, admSRj: (id) => `asr:${id}`,
  admP: (id) => `apx:${id}`, admPOk: (id) => `apo:${id}`, admPRj: (id) => `apr:${id}`,
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const dateStr = (ts) => { try { return new Date(ts).toISOString().slice(0, 10); } catch { return '—'; } };

const T = {
  welcome: () => [
    `${e('STAR', '⭐')} <b>VEYRO</b>`, '',
    `${e('SPARKLE', '✨')} Telegram Premium · Stars · Referrals`, '',
    `<i>Select an option below.</i>`,
  ].join('\n'),

  forceJoin: (missing) => [
    `${e('WARNING', '⚠️')} <b>JOIN REQUIRED</b>`, '',
    `Join the channel${missing.length > 1 ? 's' : ''} below to unlock VEYRO:`, '',
    `<i>Tap Verify after joining.</i>`,
  ].join('\n'),
  forceJoinFail: (missing) => [
    `${e('ERROR', '❌')} <b>NOT JOINED YET</b>`, '',
    'Still not joined:',
    missing.map(c => `• ${c.isPrivate ? c.title : '@' + c.username}`).join('\n'), '',
    `<i>Join and tap Verify again.</i>`,
  ].join('\n'),

  profile: (u) => [
    `${e('USER', '👤')} <b>MY PROFILE</b>`, '',
    `${e('INFO', 'ℹ️')} <b>ID</b> · <code>${u.id}</code>`,
    `<b>Name</b> · ${esc(u.firstName || '—')}`,
    `<b>Username</b> · ${u.username ? '@' + esc(u.username) : '—'}`, '',
    `${e('STAR', '⭐')} <b>Stars</b> · ${fmt(u.stars)}`,
    `${e('GIFT', '🎁')} <b>Referrals</b> · ${fmt(u.referrals)}`,
    `${e('DIAMOND', '💎')} <b>Premium</b> · ${u.premiumUntil > Date.now() ? 'Active till ' + dateStr(u.premiumUntil) : 'Not active'}`, '',
    `${e('CHECK', '✔️')} <b>Joined</b> · ${dateStr(u.createdAt)}`,
  ].join('\n'),

  refer: (u, botUsername) => [
    `${e('GIFT', '🎁')} <b>REFER & EARN</b>`, '',
    `Earn <b>${cfg().refReward} stars</b> per friend who joins.`, '',
    '<b>Your link:</b>',
    `<code>https://t.me/${botUsername}?start=ref_${u.id}</code>`, '',
    `${e('STAR', '⭐')} <b>Stars</b> · ${fmt(u.stars)}`,
    `${e('USER', '👤')} <b>Invites</b> · ${fmt(u.referrals)}`,
  ].join('\n'),

  starsShop: (u, packs) => {
    const lines = [
      `${e('STAR', '⭐')} <b>STAR TOP-UP</b>`, '',
      `<b>Balance</b> · ${fmt(u.stars)} ⭐`, '',
      '<b>Available packs</b>',
    ];
    packs.forEach(p => lines.push(`  ${p.price} ⭐  →  <b>${p.get} ⭐</b>`));
    lines.push('', '<i>Select a pack below to send request.</i>');
    return lines.join('\n');
  },

  premium: (u, plans) => {
    const lines = [
      `${e('DIAMOND', '💎')} <b>PREMIUM</b>`, '',
      `<b>Balance</b> · ${fmt(u.stars)} ⭐`,
      `<b>Status</b> · ${u.premiumUntil > Date.now() ? 'Active till ' + dateStr(u.premiumUntil) : 'Not active'}`, '',
      '<b>Plans</b>',
    ];
    plans.forEach(p => lines.push(`  ${p.label}  ·  <b>${p.cost} ⭐</b>`));
    lines.push('', '<i>Select a plan below.</i>');
    return lines.join('\n');
  },

  premiumProcessing: (frame) => [
    `${e('ROCKET', '🚀')} <b>PROCESSING</b>`, '',
    `<code>${frame}</code>`, '',
    '<i>Please wait…</i>',
  ].join('\n'),

  premiumOk: (plan, until, stars) => [
    `${e('SUCCESS', '✅')} <b>PREMIUM ACTIVATED</b>`, '',
    `<b>Plan</b> · ${plan.label}`,
    `<b>Valid till</b> · ${dateStr(until)}`,
    `<b>New balance</b> · ${fmt(stars)} ⭐`,
  ].join('\n'),

  payQR: (title, label, amount, upiId, upiName) => [
    `${e('STAR', '⭐')} <b>${title}</b>`, '',
    `${e('INFO', 'ℹ️')} <b>Item</b> · ${esc(label)}`,
    `<b>Amount</b> · ₹${amount}`,
    `<b>UPI ID</b> · <code>${esc(upiId)}</code>`,
    `<b>Name</b> · ${esc(upiName)}`, '',
    `${e('CHECK', '✔️')} <b>Steps</b>`,
    '1. Scan the QR above',
    '2. Pay the exact amount',
    "3. Tap “I've Paid”", '',
    '<i>Admin will verify & confirm.</i>',
  ].join('\n'),

  paySent: (p) => [
    `${e('SUCCESS', '✅')} <b>PAYMENT NOTED</b>`, '',
    `<b>Request ID</b> · <code>${p.id}</code>`,
    `<b>Item</b> · ${esc(p.label)}`,
    `<b>Amount</b> · ₹${p.amountInr}`, '',
    '<i>Waiting for admin verification…</i>',
  ].join('\n'),

  withdraw: (u) => [
    `${e('ROCKET', '🚀')} <b>WITHDRAW</b>`, '',
    `<b>Balance</b> · ${fmt(u.stars)} stars`,
    `<b>Minimum</b> · ${cfg().withdrawMin} stars`, '',
    '<i>Admin reviews each request.</i>',
  ].join('\n'),
  withdrawAsk: () => [
    `${e('INFO', 'ℹ️')} <b>WITHDRAW REQUEST</b>`, '',
    'Send in this format:', '',
    '<code>amount | method | details</code>', '',
    '<b>Example</b>',
    '<code>100 | UPI | yourname@upi</code>',
  ].join('\n'),
  withdrawOk: (w) => [
    `${e('SUCCESS', '✅')} <b>REQUEST SENT</b>`, '',
    `<b>ID</b> · <code>${w.id}</code>`,
    `<b>Amount</b> · ${fmt(w.amount)} stars`,
    `<b>Method</b> · ${esc(w.method)}`, '',
    '<i>Admin will review it soon.</i>',
  ].join('\n'),
  withdrawFail: (r) => [`${e('ERROR', '❌')} <b>FAILED</b>`, '', esc(r)].join('\n'),
  withdrawList: (list) => {
    const lines = [`${e('FOLDER', '📂')} <b>MY WITHDRAWALS</b>`, ''];
    if (!list.length) lines.push('<i>No requests yet.</i>');
    else list.slice(0, 10).forEach(w => lines.push(`• #${w.id} · ${fmt(w.amount)} ⭐ · <b>${w.status}</b>`));
    return lines.join('\n');
  },

  terms: () => [
    `${e('DOC', '📜')} <b>TERMS OF SERVICE</b>`, '',
    `${e('CHECK', '✔️')} <b>1.</b> Stars earned via referrals and admin grants.`,
    `${e('STAR', '⭐')} <b>2.</b> ${cfg().refReward} stars per successful referral.`,
    `${e('DIAMOND', '💎')} <b>3.</b> Premium available from 260 ⭐ per month.`,
    `${e('ROCKET', '🚀')} <b>4.</b> Minimum withdrawal · ${cfg().withdrawMin} stars.`,
    `${e('WARNING', '⚠️')} <b>5.</b> Fraud or fake referrals result in a ban.`,
    `${e('ERROR', '❌')} <b>6.</b> Misuse may result in access being revoked.`,
  ].join('\n'),

  support: () => [
    `${e('SUPPORT', '🆘')} <b>SUPPORT</b>`, '',
    `${e('INFO', 'ℹ️')} Need help?`, '',
    `${e('USER', '👤')} <b>Contact</b>`,
    `<code>${esc(cfg().support ? '@' + cfg().support : '—')}</code>`,
  ].join('\n'),

  adminMain: (users, chans, wd, sr, pay) => [
    `${e('CROWN', '👑')} <b>ADMIN PANEL</b>`, '',
    `${e('USER', '👤')} <b>Users</b> · ${users}`,
    `${e('MAIL', '📧')} <b>Channels</b> · ${chans}`,
    `${e('ROCKET', '🚀')} <b>Withdrawals</b> · ${wd}`,
    `${e('STAR', '⭐')} <b>Star Reqs</b> · ${sr}`,
    `${e('CHECK', '✔️')} <b>Payments</b> · ${pay}`,
  ].join('\n'),
  adminAddChannel: () => [
    `${e('MAIL', '📧')} <b>ADD CHANNEL</b>`, '',
    'Send the link or username.', '',
    '• <code>@username</code>',
    '• <code>https://t.me/username</code>',
    '• <code>https://t.me/+invitehash</code>',
    '• <code>username</code>', '',
    '<i>No admin rights needed.</i>',
  ].join('\n'),
  adminAddOk: (u, t) => [`${e('SUCCESS', '✅')} <b>CHANNEL ADDED</b>`, '', `<b>${esc(t)}</b>`, `<code>${esc(u.startsWith('+') ? u : '@' + u)}</code>`].join('\n'),
  adminAddFail: (r) => [`${e('ERROR', '❌')} <b>FAILED</b>`, '', esc(r)].join('\n'),
  adminListChannels: (list) => {
    const lines = [`${e('FOLDER', '📂')} <b>CHANNELS</b>`, ''];
    if (!list.length) lines.push('<i>None.</i>');
    else list.forEach(c => lines.push(`• <b>${esc(c.title)}</b> · ${c.isPrivate ? '<i>private</i>' : '@' + c.username}`));
    return lines.join('\n');
  },
  adminRemovePick: () => [`${e('TRASH', '🗑')} <b>REMOVE CHANNEL</b>`, '', 'Select a channel.'].join('\n'),
  adminRemoveConfirm: (c) => [`${e('WARNING', '⚠️')} <b>REMOVE?</b>`, '', `Remove <b>${esc(c.title)}</b>?`].join('\n'),
  adminRemoveOk: () => [`${e('SUCCESS', '✅')} <b>REMOVED</b>`, '', `${e('CHECK', '✔️')} Done.`].join('\n'),
  adminBroadcast: () => [
    `${e('ROCKET', '🚀')} <b>BROADCAST</b>`, '',
    'Send any message to broadcast.', '',
    '<i>Premium emojis, media, formatting — forwarded as-is.</i>',
  ].join('\n'),
  adminBroadcastStart: () => [`${e('ROCKET', '🚀')} <b>BROADCAST STARTED</b>`, '', '<i>Sending…</i>'].join('\n'),
  adminBroadcastResult: (ok, fail) => [`${e('SUCCESS', '✅')} <b>BROADCAST DONE</b>`, '', `Delivered · <b>${ok}</b>`, `Failed · <b>${fail}</b>`].join('\n'),

  adminWDPick: (list) => {
    const lines = [`${e('ROCKET', '🚀')} <b>WITHDRAWALS</b>`, ''];
    if (!list.length) lines.push('<i>No pending requests.</i>');
    else list.slice(0, 20).forEach(w => lines.push(`• #${w.id} · <code>${w.userId}</code> · ${fmt(w.amount)} ⭐`));
    return lines.join('\n');
  },
  adminWDDetail: (w) => [
    `${e('ROCKET', '🚀')} <b>WITHDRAW #${w.id}</b>`, '',
    `<b>User</b> · <code>${w.userId}</code>`,
    `<b>Amount</b> · ${fmt(w.amount)} ⭐`,
    `<b>Method</b> · ${esc(w.method)}`,
    `<b>Details</b> · <code>${esc(w.details)}</code>`,
  ].join('\n'),
  adminWDOk: (id) => [`${e('SUCCESS', '✅')} <b>APPROVED</b>`, '', `Withdrawal #${id} approved.`].join('\n'),
  adminWDRj: (id) => [`${e('ERROR', '❌')} <b>REJECTED</b>`, '', `Withdrawal #${id} rejected.`].join('\n'),

  adminSRPick: (list) => {
    const lines = [`${e('STAR', '⭐')} <b>STAR REQUESTS</b>`, ''];
    if (!list.length) lines.push('<i>No pending requests.</i>');
    else list.slice(0, 20).forEach(r => lines.push(`• #${r.id} · <code>${r.userId}</code> · ${r.price} ⭐ → ${r.get} ⭐`));
    return lines.join('\n');
  },
  adminSRDetail: (r) => [
    `${e('STAR', '⭐')} <b>STAR REQ #${r.id}</b>`, '',
    `<b>User</b> · <code>${r.userId}</code>`,
    `<b>Requested</b> · ${r.price} ⭐`,
    `<b>To credit</b> · ${r.get} ⭐`,
  ].join('\n'),
  adminSROk: (id, amt) => [`${e('SUCCESS', '✅')} <b>APPROVED</b>`, '', `Request #${id} approved.`, `Credited · ${amt} ⭐`].join('\n'),
  adminSRRj: (id) => [`${e('ERROR', '❌')} <b>REJECTED</b>`, '', `Request #${id} rejected.`].join('\n'),

  adminPayPick: (list) => {
    const lines = [`${e('STAR', '⭐')} <b>PAYMENTS</b>`, ''];
    if (!list.length) lines.push('<i>No pending payments.</i>');
    else list.slice(0, 20).forEach(p => lines.push(`• #${p.id} · <code>${p.userId}</code> · ₹${p.amountInr} · ${esc(p.type)}`));
    return lines.join('\n');
  },
  adminPayDetail: (p) => [
    `${e('STAR', '⭐')} <b>PAYMENT #${p.id}</b>`, '',
    `<b>User</b> · <code>${p.userId}</code>`,
    `<b>Type</b> · ${esc(p.type)}`,
    `<b>Item</b> · ${esc(p.label)}`,
    `<b>Amount</b> · ₹${p.amountInr}`,
  ].join('\n'),
  adminPayOk: (id) => [`${e('SUCCESS', '✅')} <b>APPROVED</b>`, '', `Payment #${id} approved.`].join('\n'),
  adminPayRj: (id) => [`${e('ERROR', '❌')} <b>REJECTED</b>`, '', `Payment #${id} rejected.`].join('\n'),

  adminGrant: () => [
    `${e('STAR', '⭐')} <b>GRANT STARS</b>`, '',
    'Format · <code>user_id | amount</code>', '',
    'Example · <code>8745088070 | 100</code>',
  ].join('\n'),
  adminGrantOk: (id, amt, total) => [`${e('SUCCESS', '✅')} <b>GRANTED</b>`, '', `User · <code>${id}</code>`, `Amount · +${amt} ⭐`, `Balance · ${total} ⭐`].join('\n'),
};

const K = {
  main: (isAdmin) => {
    const r = [
      [btn('My Profile', CB.PROFILE, 'primary'), btn('Refer & Earn', CB.REFER, 'success')],
      [btn('Stars', CB.STARS, 'primary'), btn('Premium', CB.PREMIUM, 'success')],
      [btn('Withdraw', CB.WITHDRAW, 'primary'), btn('Terms', CB.TOS, 'primary')],
      [btn('Support', CB.SUP, 'primary')],
    ];
    if (isAdmin) r.push([btn('Admin Panel', CB.ADMIN, 'success')]);
    return r;
  },
  back: () => [[btn('Back', CB.MAIN, 'primary')]],
  cancel: () => [[btn('Cancel', CB.MAIN, 'danger')]],
  refer: (u, botUsername) => [
    [urlBtn('Share', `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${u.id}&text=Join%20VEYRO`), btn('Copy Link', CB.REF_COPY, 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  starsShop: (packs) => {
    const rows = [];
    for (let i = 0; i < packs.length; i += 2) {
      const row = [btn(`${packs[i].price} ⭐ → ${packs[i].get} ⭐`, CB.STAR_PICK(packs[i].id), 'primary')];
      if (packs[i + 1]) row.push(btn(`${packs[i + 1].price} ⭐ → ${packs[i + 1].get} ⭐`, CB.STAR_PICK(packs[i + 1].id), 'primary'));
      rows.push(row);
    }
    rows.push([btn('Back', CB.MAIN, 'primary')]);
    return rows;
  },
  premium: (plans) => {
    const rows = plans.map(p => [btn(`${p.label}  ·  ${p.cost} ⭐`, CB.PM_PICK(p.id), 'primary')]);
    rows.push([btn('Back', CB.MAIN, 'primary')]);
    return rows;
  },
  payQR: (id) => [
    [btn("I've Paid", CB.PAY_PAID(id), 'success')],
    [btn('Cancel', CB.PAY_CANCEL(id), 'danger')],
  ],
  withdraw: () => [
    [btn('Request Withdrawal', CB.WITHDRAW_REQUEST, 'success')],
    [btn('My Requests', CB.WITHDRAW + ':list', 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  withdrawCancel: () => [[btn('Cancel', CB.WITHDRAW, 'danger')]],
  withdrawOk: () => [[btn('My Requests', CB.WITHDRAW + ':list', 'primary')], [btn('Back', CB.MAIN, 'primary')]],
  support: () => [[btn('Contact Support', CB.SUP + ':c', 'success')], [btn('Back', CB.MAIN, 'primary')]],
  forceJoin: (missing) => {
    const rows = missing.map(c => [urlBtn(`Join ${c.isPrivate ? c.title : '@' + c.username}`, `https://t.me/${c.username}`)]);
    rows.push([btn('Verify', CB.VERIFY, 'success')]);
    return rows;
  },
  forceJoinFail: (missing) => {
    const rows = missing.map(c => [urlBtn(`Join ${c.isPrivate ? c.title : '@' + c.username}`, `https://t.me/${c.username}`)]);
    rows.push([btn('Verify Again', CB.VERIFY, 'success')]);
    return rows;
  },
  adminMain: () => [
    [btn('Add Channel', CB.ADM_ADD, 'success'), btn('My Channels', CB.ADM_LIST, 'primary')],
    [btn('Remove Channel', CB.ADM_REMOVE, 'danger'), btn('Withdrawals', CB.ADM_WD, 'primary')],
    [btn('Star Requests', CB.ADM_SR, 'success'), btn('Payments', CB.ADM_PAY, 'primary')],
    [btn('Grant Stars', CB.ADM_GRANT, 'success'), btn('Broadcast', CB.ADM_BC, 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  adminBack: () => [[btn('Back', CB.ADMIN, 'primary')]],
  adminAddOk: () => [[btn('My Channels', CB.ADM_LIST, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminRemoveList: (list) => [
    ...list.map(c => [btn(`Remove ${c.isPrivate ? c.title : '@' + c.username}`, CB.admRemove(c.username), 'danger')]),
    [btn('Back', CB.ADMIN, 'primary')],
  ],
  adminRemoveConfirm: (u) => [[btn('Confirm Remove', CB.admRemoveOk(u), 'danger')], [btn('Cancel', CB.ADMIN, 'primary')]],
  adminRemoveOk: () => [[btn('My Channels', CB.ADM_LIST, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminBroadcastResult: () => [[btn('Back', CB.ADMIN, 'primary')]],
  adminWDList: (list) => [
    ...list.slice(0, 20).map(w => [btn(`#${w.id} · ${fmt(w.amount)} ⭐`, CB.admW(w.id), 'primary')]),
    [btn('Back', CB.ADMIN, 'primary')],
  ],
  adminWDDetail: (id) => [
    [btn('Approve', CB.admWOk(id), 'success'), btn('Reject', CB.admWRj(id), 'danger')],
    [btn('Back', CB.ADM_WD, 'primary')],
  ],
  adminWDDone: () => [[btn('Withdrawals', CB.ADM_WD, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminSRList: (list) => [
    ...list.slice(0, 20).map(r => [btn(`#${r.id} · ${r.price}→${r.get} ⭐`, CB.admS(r.id), 'primary')]),
    [btn('Back', CB.ADMIN, 'primary')],
  ],
  adminSRDetail: (id) => [
    [btn('Approve', CB.admSOk(id), 'success'), btn('Reject', CB.admSRj(id), 'danger')],
    [btn('Back', CB.ADM_SR, 'primary')],
  ],
  adminSRDone: () => [[btn('Star Requests', CB.ADM_SR, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminPayList: (list) => [
    ...list.slice(0, 20).map(p => [btn(`#${p.id} · ₹${p.amountInr} · ${p.type}`, CB.admP(p.id), 'primary')]),
    [btn('Back', CB.ADMIN, 'primary')],
  ],
  adminPayDetail: (id) => [
    [btn('Approve', CB.admPOk(id), 'success'), btn('Reject', CB.admPRj(id), 'danger')],
    [btn('Back', CB.ADM_PAY, 'primary')],
  ],
  adminPayDone: () => [[btn('Payments', CB.ADM_PAY, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminGrantOk: () => [[btn('Back', CB.ADMIN, 'primary')]],
};

module.exports = { CB, T, K, kb, esc, stripCustomEmojis, blacklistEmojisIn };
