const cfg = () => global.VEYRO;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const badEmojiIds = new Set();

function e(key, fallback) {
  const c = cfg();
  if (!c.useCustomEmojis) return fallback;
  const id = c.emojis[key];
  if (!id || badEmojiIds.has(id)) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}
function stripCustomEmojis(t) { return String(t).replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/g, '$1'); }
function blacklistEmojisIn(t) { [...String(t).matchAll(/emoji-id="(\d+)"/g)].forEach(m => badEmojiIds.add(m[1])); }

/* Buttons — no emoji, colored */
function btn(text, data, style) {
  const b = { text, callback_data: data };
  if (style && cfg().buttonStyles) b.style = style;
  return b;
}
function urlBtn(text, url) { return { text, url }; }
const kb = (rows) => ({ inline_keyboard: rows });

const CB = {
  MAIN: 'm', ADD: 'ga', LIST: 'gl', SEC: 'sc', ACC: 'ac', TOS: 'ts', SUP: 'sp',
  VERIFY: 'vfy',
  ADMIN: 'adm', ADM_ADD: 'aa', ADM_LIST: 'al', ADM_REMOVE: 'ar',
  admRemove: (u) => `arx:${u}`,
  admRemoveOk: (u) => `aro:${u}`,
  ADM_BC: 'abc',
  view: (i) => `gv:${i}`, del: (i) => `gd:${i}`, delOk: (i) => `gdx:${i}`,
  reveal: (i) => `gr:${i}`, hide: (i) => `gh:${i}`,
  pinSet: 'ps', pinChange: 'pc', pinDisable: 'pd', pinDisableOk: 'pdx', pinRetry: 'prt',
};

const dateStr = (ts) => { try { return new Date(ts).toISOString().slice(0, 10); } catch { return '—'; } };
const maskPwd = () => '••••••••';

const T = {
  welcome: () => [
    `${e('STAR', '⭐')} <b>VEYRO</b>`, '',
    `${e('MAIL', '📧')} Manage your Gmail accounts`,
    `${e('LOCK', '🔐')} securely and privately.`, '',
    `<i>Select an option below.</i>`,
  ].join('\n'),

  forceJoin: (missing) => [
    `${e('WARNING', '⚠️')} <b>JOIN REQUIRED</b>`, '',
    `Please join the following channel${missing.length > 1 ? 's' : ''}`,
    `to continue using VEYRO.`, '',
    `<i>Then tap Verify.</i>`,
  ].join('\n'),

  forceJoinFail: (missing) => [
    `${e('ERROR', '❌')} <b>NOT JOINED YET</b>`, '',
    `You still need to join:`,
    missing.map(c => `• @${c.username}`).join('\n'), '',
    `<i>Join and tap Verify again.</i>`,
  ].join('\n'),

  gmailAddEmail: () => [`${e('MAIL', '📧')} <b>ADD GMAIL</b>`, '', 'Send the Gmail address you want to save.'].join('\n'),
  gmailAddPassword: (email) => [`${e('KEY', '🔑')} <b>ADD PASSWORD</b>`, '', `<code>${esc(email)}</code>`, '', 'Send the password for this account.', `<i>${e('LOCK', '🔒')} Encrypted with AES-256-GCM.</i>`].join('\n'),
  gmailAdded: (email) => [`${e('SUCCESS', '✅')} <b>GMAIL SAVED</b>`, '', `<code>${esc(email)}</code>`, '', `${e('LOCK', '🔐')} Password encrypted.`].join('\n'),
  gmailInvalid: () => [`${e('WARNING', '⚠️')} <b>INVALID GMAIL</b>`, '', `${e('ERROR', '❌')} That is not a valid address.`, '', 'Example: <code>example@gmail.com</code>'].join('\n'),
  gmailPwdInvalid: () => [`${e('WARNING', '⚠️')} <b>INVALID PASSWORD</b>`, '', `${e('ERROR', '❌')} Password must be 1–200 characters.`].join('\n'),
  gmailDup: () => [`${e('WARNING', '⚠️')} <b>ALREADY SAVED</b>`, '', `${e('INFO', 'ℹ️')} This Gmail is already in your list.`].join('\n'),
  gmailList: (emails) => emails.length
    ? [`${e('FOLDER', '📂')} <b>MY GMAIL</b>`, '', `${e('MAIL', '📧')} ${emails.length} account${emails.length > 1 ? 's' : ''} saved.`, '', '<i>Tap to view details.</i>'].join('\n')
    : [`${e('FOLDER', '📂')} <b>MY GMAIL</b>`, '', `${e('INFO', 'ℹ️')} No Gmail added yet.`].join('\n'),

  gmailDetails: (entry, showPwd, plainPwd) => {
    const lines = [`${e('MAIL', '📧')} <b>GMAIL DETAILS</b>`, '', `${e('INFO', 'ℹ️')} <b>Email</b>`, `<code>${esc(entry.email)}</code>`, ''];
    if (entry.passwordEnc) {
      lines.push(`${e('KEY', '🔑')} <b>Password</b>`, showPwd && plainPwd ? `<code>${esc(plainPwd)}</code>` : `<code>${maskPwd()}</code>`);
    } else lines.push(`<i>${e('WARNING', '⚠️')} No password stored.</i>`);
    return lines.join('\n');
  },

  gmailDel: (email) => [`${e('WARNING', '⚠️')} <b>DELETE GMAIL</b>`, '', 'Remove this account?', '', `<code>${esc(email)}</code>`, '', '<i>Password will also be deleted.</i>'].join('\n'),
  gmailDelOk: () => [`${e('SUCCESS', '✅')} <b>REMOVED</b>`, '', `${e('CHECK', '✔️')} Gmail and password removed.`].join('\n'),

  security: (u) => [`${e('SECURITY', '🔐')} <b>SECURITY</b>`, '', `${e('LOCK', '🔒')} Protect your Gmail with a PIN.`, '', `<b>Status:</b> ${u?.pinEnabled ? 'Enabled' : 'Disabled'}`].join('\n'),
  pinSetPrompt: () => [`${e('SECURITY', '🔐')} <b>SET PIN</b>`, '', `${e('KEY', '🔑')} Send your PIN in the chat.`, '', `<i>${cfg().pinMin}–${cfg().pinMax} digits.</i>`].join('\n'),
  pinEnabled: () => [`${e('SUCCESS', '✅')} <b>PIN ENABLED</b>`, '', `${e('LOCK', '🔒')} Your data is now protected.`].join('\n'),
  pinChangeCurrent: () => [`${e('REFRESH', '🔄')} <b>CHANGE PIN</b>`, '', `${e('KEY', '🔑')} Send your current PIN.`].join('\n'),
  pinChangeNew: () => [`${e('KEY', '🔑')} <b>NEW PIN</b>`, '', `Send your new PIN (${cfg().pinMin}–${cfg().pinMax} digits).`].join('\n'),
  pinChanged: () => [`${e('SUCCESS', '✅')} <b>PIN UPDATED</b>`, '', `${e('CHECK', '✔️')} Your PIN has been changed.`].join('\n'),
  pinDisableCurrent: () => [`${e('UNLOCK', '🔓')} <b>DISABLE PIN</b>`, '', `${e('KEY', '🔑')} Send your current PIN.`].join('\n'),
  pinDisableConfirm: () => [`${e('WARNING', '⚠️')} <b>DISABLE PROTECTION?</b>`, '', `${e('UNLOCK', '🔓')} Your Gmail will be accessible without a PIN.`, '', '<i>Your Gmail records will NOT be deleted.</i>'].join('\n'),
  pinDisabled: () => [`${e('SUCCESS', '✅')} <b>PIN DISABLED</b>`, '', `${e('UNLOCK', '🔓')} Protection turned off.`].join('\n'),
  pinProtected: () => [`${e('SECURITY', '🔐')} <b>PROTECTED</b>`, '', `${e('KEY', '🔑')} Send your security PIN.`].join('\n'),
  pinWrong: () => [`${e('ERROR', '❌')} <b>INCORRECT PIN</b>`, '', `${e('WARNING', '⚠️')} Please try again.`].join('\n'),
  pinLocked: (sec) => [`${e('LOCK', '🔒')} <b>TEMPORARILY LOCKED</b>`, '', `${e('WARNING', '⚠️')} Too many failed attempts.`, `Try again in ${Math.ceil(sec/60)} minute${Math.ceil(sec/60) > 1 ? 's' : ''}.`].join('\n'),
  pinBadFormat: () => [`${e('WARNING', '⚠️')} <b>INVALID PIN</b>`, '', `${e('ERROR', '❌')} PIN must be ${cfg().pinMin}–${cfg().pinMax} digits.`].join('\n'),

  account: (u, n) => [
    `${e('USER', '👤')} <b>MY ACCOUNT</b>`, '',
    `${e('INFO', 'ℹ️')} <b>Telegram ID</b>`, `<code>${u.id}</code>`, '',
    '<b>Username</b>', u.username ? `@${esc(u.username)}` : '—', '',
    `${e('MAIL', '📧')} <b>Saved Gmail</b>`, String(n), '',
    `${e('LOCK', '🔐')} <b>Security</b>`, u.pinEnabled ? 'Enabled' : 'Disabled', '',
    `${e('STAR', '⭐')} <b>Joined</b>`, dateStr(u.createdAt),
  ].join('\n'),

  terms: () => [
    `${e('DOC', '📜')} <b>TERMS OF SERVICE</b>`, '',
    `${e('CHECK', '✔️')} <b>1.</b> VEYRO stores Gmail addresses and passwords you provide.`,
    `${e('LOCK', '🔒')} <b>2.</b> Passwords are encrypted with AES-256-GCM.`,
    `${e('WARNING', '⚠️')} <b>3.</b> Data may be lost on server restart or redeploy.`,
    `${e('KEY', '🔑')} <b>4.</b> You are responsible for your Telegram account and PIN.`,
    `${e('ERROR', '❌')} <b>5.</b> Misuse may result in access being revoked.`,
    `${e('HEART', '❤️')} <b>6.</b> By using VEYRO, you agree to these terms.`,
  ].join('\n'),

  support: () => [`${e('SUPPORT', '🆘')} <b>SUPPORT</b>`, '', `${e('INFO', 'ℹ️')} Need help?`, '', `${e('USER', '👤')} <b>Contact</b>`, `<code>${esc(cfg().support ? '@' + cfg().support : '—')}</code>`].join('\n'),

  /* ADMIN */
  adminMain: (users, chans) => [`${e('CROWN', '👑')} <b>ADMIN PANEL</b>`, '', `${e('USER', '👤')} <b>Users</b> · ${users}`, `${e('MAIL', '📧')} <b>Channels</b> · ${chans}`].join('\n'),
  adminAddChannel: () => [`${e('MAIL', '📧')} <b>ADD CHANNEL</b>`, '', 'Send the channel <b>@username</b>.', '', '<i>Bot must be an admin in that channel.</i>'].join('\n'),
  adminAddOk: (u, t) => [`${e('SUCCESS', '✅')} <b>CHANNEL ADDED</b>`, '', `<b>${esc(t)}</b>`, `<code>@${esc(u)}</code>`].join('\n'),
  adminAddFail: (reason) => [`${e('ERROR', '❌')} <b>FAILED</b>`, '', esc(reason)].join('\n'),
  adminListChannels: (list) => list.length
    ? [`${e('FOLDER', '📂')} <b>CHANNELS</b>`, '', ...list.map(c => `• <b>${esc(c.title)}</b> · @${c.username}`)].join('\n')
    : [`${e('FOLDER', '📂')} <b>CHANNELS</b>`, '', '<i>No channels added.</i>'].join('\n'),
  adminRemovePick: () => [`${e('TRASH', '🗑')} <b>REMOVE CHANNEL</b>`, '', 'Select a channel to remove.'].join('\n'),
  adminRemoveConfirm: (c) => [`${e('WARNING', '⚠️')} <b>REMOVE CHANNEL</b>`, '', `Remove <b>${esc(c.title)}</b> (@${c.username})?`].join('\n'),
  adminRemoveOk: () => [`${e('SUCCESS', '✅')} <b>CHANNEL REMOVED</b>`, '', `${e('CHECK', '✔️')} Done.`].join('\n'),
  adminBroadcast: () => [`${e('ROCKET', '🚀')} <b>BROADCAST</b>`, '', 'Send the message to broadcast to all users.', '', `<i>Text-only for now.</i>`].join('\n'),
  adminBroadcastResult: (ok, fail) => [`${e('SUCCESS', '✅')} <b>BROADCAST SENT</b>`, '', `Delivered: <b>${ok}</b>`, `Failed: <b>${fail}</b>`].join('\n'),
};

const K = {
  main: (isAdmin) => {
    const r = [
      [btn('Add Gmail', CB.ADD, 'primary'), btn('My Gmail', CB.LIST, 'primary')],
      [btn('Security', CB.SEC, 'primary'), btn('My Account', CB.ACC, 'primary')],
      [btn('Terms', CB.TOS, 'primary'), btn('Support', CB.SUP, 'primary')],
    ];
    if (isAdmin) r.push([btn('Admin Panel', CB.ADMIN, 'success')]);
    return r;
  },
  cancel: () => [[btn('Cancel', CB.MAIN, 'danger')]],
  gmailAdded: () => [
    [btn('My Gmail', CB.LIST, 'primary')],
    [btn('Add Another', CB.ADD, 'success')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  gmailEmpty: () => [[btn('Add Gmail', CB.ADD, 'primary')], [btn('Back', CB.MAIN, 'primary')]],
  gmailList: (emails) => [...emails.map((em, i) => [btn(em, CB.view(i), 'primary')]), [btn('Back', CB.MAIN, 'primary')]],
  gmailDetails: (i, hasPwd, shown) => {
    const r = [];
    if (hasPwd) r.push([shown ? btn('Hide Password', CB.hide(i), 'primary') : btn('Show Password', CB.reveal(i), 'success')]);
    r.push([btn('Delete', CB.del(i), 'danger')]);
    r.push([btn('Back', CB.LIST, 'primary')]);
    return r;
  },
  gmailDelConfirm: (i) => [[btn('Confirm Delete', CB.delOk(i), 'danger')], [btn('Cancel', CB.view(i), 'primary')]],
  gmailDeleted: () => [[btn('My Gmail', CB.LIST, 'primary')], [btn('Back', CB.MAIN, 'primary')]],
  security: (u) => {
    const r = [];
    if (!u?.pinEnabled) r.push([btn('Set PIN', CB.pinSet, 'success')]);
    else { r.push([btn('Change PIN', CB.pinChange, 'primary')]); r.push([btn('Disable PIN', CB.pinDisable, 'danger')]); }
    r.push([btn('Back', CB.MAIN, 'primary')]);
    return r;
  },
  pinResult: () => [[btn('My Gmail', CB.LIST, 'primary')], [btn('Back', CB.MAIN, 'primary')]],
  protected: () => [[btn('Cancel', CB.MAIN, 'danger')]],
  pinWrong: () => [[btn('Try Again', CB.pinRetry, 'success')], [btn('Back', CB.MAIN, 'primary')]],
  pinDisableConfirm: () => [[btn('Disable', CB.pinDisableOk, 'danger')], [btn('Cancel', CB.SEC, 'primary')]],
  back: () => [[btn('Back', CB.MAIN, 'primary')]],
  support: () => [[btn('Contact Support', CB.SUP + ':c', 'success')], [btn('Back', CB.MAIN, 'primary')]],

  forceJoin: (missing) => {
    const rows = missing.map(c => [urlBtn(`Join @${c.username}`, `https://t.me/${c.username}`)]);
    rows.push([btn('Verify', CB.VERIFY, 'success')]);
    return rows;
  },
  forceJoinFail: (missing) => {
    const rows = missing.map(c => [urlBtn(`Join @${c.username}`, `https://t.me/${c.username}`)]);
    rows.push([btn('Verify Again', CB.VERIFY, 'success')]);
    return rows;
  },

  adminMain: () => [
    [btn('Add Channel', CB.ADM_ADD, 'success')],
    [btn('My Channels', CB.ADM_LIST, 'primary')],
    [btn('Remove Channel', CB.ADM_REMOVE, 'danger')],
    [btn('Broadcast', CB.ADM_BC, 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  adminBack: () => [[btn('Back', CB.ADMIN, 'primary')]],
  adminAddOk: () => [[btn('My Channels', CB.ADM_LIST, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminRemoveList: (list) => [
    ...list.map(c => [btn(`Remove @${c.username}`, CB.admRemove(c.username), 'danger')]),
    [btn('Back', CB.ADMIN, 'primary')],
  ],
  adminRemoveConfirm: (u) => [
    [btn('Confirm Remove', CB.admRemoveOk(u), 'danger')],
    [btn('Cancel', CB.ADMIN, 'primary')],
  ],
  adminRemoveOk: () => [[btn('My Channels', CB.ADM_LIST, 'primary')], [btn('Back', CB.ADMIN, 'primary')]],
  adminBroadcastResult: () => [[btn('Back', CB.ADMIN, 'primary')]],
};

module.exports = { CB, T, K, kb, esc, stripCustomEmojis, blacklistEmojisIn };
