const cfg = () => global.VEYRO;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const POOL = [
  '6206255067301947207','6206294761389695640','6206088113333216310',
  '6205968305220492697','6206284698281320197','6206100770601837006',
  '6206024556407170232','6206007161789619181','6206300825883517533',
  '6206460237889678062','6206165792111731429','6206475558038019634',
  '6206455221367873730','6206138759587570621','6205996153788441611',
  '6206474832188548530','6206313951303575343','6206111160127725728',
  '6206262115343277829','6206495929067905775','6206387532683289060',
  '6206162356137893537','6206062450903621510','6206355870184384612',
  '5341715473882955310','5440539497383087970',
];
const badEmojiIds = new Set();
function pickId() {
  const clean = POOL.filter(id => !badEmojiIds.has(id));
  if (!clean.length) return null;
  return clean[Math.floor(Math.random() * clean.length)];
}
function e(_key, fallback) {
  const c = cfg();
  if (!c.useCustomEmojis) return fallback;
  const id = pickId();
  if (!id) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}
function stripCustomEmojis(t) { return String(t).replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/g, '$1'); }
function blacklistEmojisIn(t) { [...String(t).matchAll(/emoji-id="(\d+)"/g)].forEach(m => badEmojiIds.add(m[1])); }

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
  WITHDRAW_REQUEST: 'wdr',
  ADMIN: 'adm', ADM_ADD: 'aa', ADM_LIST: 'al', ADM_REMOVE: 'ar',
  admRemove: (u) => `arx:${u}`, admRemoveOk: (u) => `aro:${u}`,
  ADM_BC: 'abc', ADM_WD: 'awd', ADM_GRANT: 'agr',
  admW: (id) => `awx:${id}`, admWOk: (id) => `awo:${id}`, admWRj: (id) => `awr:${id}`,
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const dateStr = (ts) => { try { return new Date(ts).toISOString().slice(0, 10); } catch { return '—'; } };

const T = {
  welcome: () => [
    `${e('STAR', '⭐')} <b>VEYRO</b>`, '',
    'Telegram Premium · Stars · Referrals', '',
    `<i>Select an option below.</i>`,
  ].join('\n'),

  forceJoin: (missing) => [
    `${e('WARNING', '⚠️')} <b>JOIN REQUIRED</b>`, '',
    `Join the following channel${missing.length > 1 ? 's' : ''}:`, '',
    `<i>Then tap Verify.</i>`,
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

  stars: (u) => [
    `${e('STAR', '⭐')} <b>STARS</b>`, '',
    `<b>Balance</b> · ${fmt(u.stars)}`, '',
    '<b>Earn:</b>',
    `• Invite friends · +${cfg().refReward} stars`,
    '• Admin grants',
    '• Premium rewards', '',
    '<b>Use:</b>',
    `• Buy Premium · ${cfg().premiumCost} stars`,
    `• Withdraw · min ${cfg().withdrawMin} stars`,
  ].join('\n'),

  premium: (u) => {
    const active = u.premiumUntil > Date.now();
    return [
      `${e('DIAMOND', '💎')} <b>PREMIUM</b>`, '',
      `<b>Status</b> · ${active ? 'Active' : 'Inactive'}`,
      active ? `<b>Expires</b> · ${dateStr(u.premiumUntil)}` : '',
      `<b>Price</b> · ${cfg().premiumCost} stars / ${cfg().premiumDays} days`, '',
      `<b>Balance</b> · ${fmt(u.stars)} stars`,
    ].filter(Boolean).join('\n');
  },
  premiumOk: (until) => [`${e('SUCCESS', '✅')} <b>PREMIUM ACTIVATED</b>`, '', `Valid until <b>${dateStr(until)}</b>.`].join('\n'),

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
    `${e('DIAMOND', '💎')} <b>3.</b> Premium · ${cfg().premiumCost} stars for ${cfg().premiumDays} days.`,
    `${e('ROCKET', '🚀')} <b>4.</b> Minimum withdrawal · ${cfg().withdrawMin} stars.`,
    `${e('WARNING', '⚠️')} <b>5.</b> Fraud or fake referrals result in a ban.`,
    `${e('ERROR', '❌')} <b>6.</b> Misuse may result in access being revoked.`,
  ].join('\n'),

  support: () => [`${e('SUPPORT', '🆘')} <b>SUPPORT</b>`, '', `${e('INFO', 'ℹ️')} Need help?`, '', `${e('USER', '👤')} <b>Contact</b>`, `<code>${esc(cfg().support ? '@' + cfg().support : '—')}</code>`].join('\n'),

  adminMain: (users, chans, wd) => [
    `${e('CROWN', '👑')} <b>ADMIN PANEL</b>`, '',
    `${e('USER', '👤')} <b>Users</b> · ${users}`,
    `${e('MAIL', '📧')} <b>Channels</b> · ${chans}`,
    `${e('ROCKET', '🚀')} <b>Pending WD</b> · ${wd}`,
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
    else list.slice(0, 20).forEach(w => lines.push(`• #${w.id} · user <code>${w.userId}</code> · ${fmt(w.amount)} ⭐`));
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
  adminGrant: () => [
    `${e('STAR', '⭐')} <b>GRANT STARS</b>`, '',
    'Send in this format:', '',
    '<code>user_id | amount</code>', '',
    '<b>Example</b>',
    '<code>8745088070 | 100</code>',
  ].join('\n'),
  adminGrantOk: (id, amt, total) => [`${e('SUCCESS', '✅')} <b>GRANTED</b>`, '', `User · <code>${id}</code>`, `Amount · +${amt} ⭐`, `New balance · ${total} ⭐`].join('\n'),
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
  stars: () => [[btn('Back', CB.MAIN, 'primary')]],
  premium: (u) => {
    const r = [];
    r.push([btn(u.premiumUntil > Date.now() ? 'Extend Premium' : 'Buy Premium', CB.PREMIUM + ':buy', 'success')]);
    r.push([btn('Back', CB.MAIN, 'primary')]);
    return r;
  },
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
  adminGrantOk: () => [[btn('Back', CB.ADMIN, 'primary')]],
};

module.exports = { CB, T, K, kb, esc, stripCustomEmojis, blacklistEmojisIn };
