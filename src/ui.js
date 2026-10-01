const cfg = () => global.VEYRO;

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ─────────  CUSTOM EMOJI  ───────── */
function e(key, fallback) {
  const c = cfg();
  if (!c.useCustomEmojis) return fallback;
  const id = c.emojis[key];
  return id ? `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>` : fallback;
}

/* Remove <tg-emoji> tags if Telegram rejects them */
function stripCustomEmojis(text) {
  return String(text).replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/g, '$1');
}

/* ─────────  BUTTON BUILDER  ───────── */
function btn(text, data, style) {
  const b = { text, callback_data: data };
  if (style && cfg().buttonStyles) b.style = style;
  return b;
}
const kb = (rows) => ({ inline_keyboard: rows });

/* ─────────  CALLBACK IDS  ───────── */
const CB = {
  MAIN: 'm', ADD: 'ga', LIST: 'gl', SEC: 'sc', ACC: 'ac', TOS: 'ts', SUP: 'sp',
  view: (i) => `gv:${i}`, del: (i) => `gd:${i}`, delOk: (i) => `gdx:${i}`,
  pinSet: 'ps', pinChange: 'pc', pinDisable: 'pd', pinDisableOk: 'pdx', pinRetry: 'prt',
};

/* ─────────  HEADER  ───────── */
const TOP = '╭━━━━━━━━━━━━━━━━━━━━╮';
const BOT = '╰━━━━━━━━━━━━━━━━━━━━╯';
const head = (label) => `${TOP}\n       ${label}\n${BOT}`;
const dateStr = (ts) => { try { return new Date(ts).toISOString().slice(0, 10); } catch { return '—'; } };

/* ─────────  TEXTS  ───────── */
const T = {
  welcome: () => [
    head(`${e('STAR', '✦')} <b>VEYRO</b>`), '',
    `${e('SPARKLE', '✨')} <b>Welcome to Veyro</b>`, '',
    `${e('MAIL', '📧')} Manage your saved Gmail addresses`,
    `${e('LOCK', '🔐')} through a clean and secure interface.`, '',
    `<i>${e('DIAMOND', '💎')} Premium Gmail Manager</i>`,
  ].join('\n'),

  gmailAdd: () => [
    head(`${e('MAIL', '📧')} <b>ADD GMAIL</b>`), '',
    `${e('INFO', 'ℹ️')} Enter the Gmail address you want to save.`, '',
    `<i>${e('CHECK', '✔️')} Only valid Gmail addresses are accepted.</i>`,
  ].join('\n'),

  gmailAdded: (email) => [
    head(`${e('SUCCESS', '✅')} <b>GMAIL ADDED</b>`), '',
    `${e('MAIL', '📧')} <code>${esc(email)}</code>`, '',
    `${e('CHECK', '✔️')} Saved successfully.`,
  ].join('\n'),

  gmailInvalid: () => [
    head(`${e('WARNING', '⚠️')} <b>INVALID GMAIL</b>`), '',
    `${e('ERROR', '❌')} That is not a valid Gmail address.`, '',
    `${e('INFO', 'ℹ️')} Example: <code>example@gmail.com</code>`,
  ].join('\n'),

  gmailDup: () => [
    head(`${e('WARNING', '⚠️')} <b>ALREADY SAVED</b>`), '',
    `${e('INFO', 'ℹ️')} This Gmail is already in your list.`,
  ].join('\n'),

  gmailList: (emails) =>
    emails.length
      ? [head(`${e('FOLDER', '📂')} <b>MY GMAIL</b>`), '',
         `${e('MAIL', '📧')} You have <b>${emails.length}</b> saved Gmail${emails.length > 1 ? 's' : ''}.`, '',
         '<i>Tap an address to view details.</i>'].join('\n')
      : [head(`${e('FOLDER', '📂')} <b>MY GMAIL</b>`), '',
         `${e('INFO', 'ℹ️')} You haven't added any Gmail yet.`].join('\n'),

  gmailDetails: (email) => [
    head(`${e('MAIL', '📧')} <b>GMAIL DETAILS</b>`), '',
    `${e('INFO', 'ℹ️')} <b>Email</b>`,
    `<code>${esc(email)}</code>`,
  ].join('\n'),

  gmailDel: (email) => [
    head(`${e('WARNING', '⚠️')} <b>DELETE GMAIL</b>`), '',
    `${e('INFO', 'ℹ️')} Are you sure you want to remove:`, '',
    `${e('MAIL', '📧')} <code>${esc(email)}</code>`,
  ].join('\n'),

  gmailDelOk: () => [
    head(`${e('SUCCESS', '✅')} <b>REMOVED</b>`), '',
    `${e('CHECK', '✔️')} Gmail removed successfully.`,
  ].join('\n'),

  security: (u) => {
    const st = u?.pinEnabled
      ? `${e('SUCCESS', '🟢')} <b>Enabled</b>`
      : `${e('WARNING', '⚪')} <b>Disabled</b>`;
    return [
      head(`${e('SECURITY', '🔐')} <b>SECURITY</b>`), '',
      `${e('LOCK', '🔒')} Protect access to your saved Gmail`,
      'addresses with a personal PIN.', '',
      `<b>Status:</b> ${st}`,
    ].join('\n');
  },

  pinSetPrompt: () => [
    head(`${e('SECURITY', '🔐')} <b>SET SECURITY PIN</b>`), '',
    `${e('KEY', '🔑')} Enter your PIN in the chat.`, '',
    `<i>${e('INFO', 'ℹ️')} Recommended: ${cfg().pinMin}–${cfg().pinMax} digits.</i>`,
  ].join('\n'),

  pinEnabled: () => [
    head(`${e('SUCCESS', '✅')} <b>PIN ENABLED</b>`), '',
    `${e('LOCK', '🔒')} Your Gmail data is now protected.`,
  ].join('\n'),

  pinChangeCurrent: () => [
    head(`${e('REFRESH', '🔄')} <b>CHANGE PIN</b>`), '',
    `${e('KEY', '🔑')} Enter your <b>current</b> PIN.`,
  ].join('\n'),

  pinChangeNew: () => [
    head(`${e('KEY', '🔑')} <b>NEW PIN</b>`), '',
    `${e('INFO', 'ℹ️')} Enter your new PIN (${cfg().pinMin}–${cfg().pinMax} digits).`,
  ].join('\n'),

  pinChanged: () => [
    head(`${e('SUCCESS', '✅')} <b>PIN UPDATED</b>`), '',
    `${e('CHECK', '✔️')} Your PIN was changed successfully.`,
  ].join('\n'),

  pinDisableCurrent: () => [
    head(`${e('UNLOCK', '🔓')} <b>DISABLE PIN</b>`), '',
    `${e('KEY', '🔑')} Enter your current PIN to continue.`,
  ].join('\n'),

  pinDisableConfirm: () => [
    head(`${e('WARNING', '⚠️')} <b>DISABLE PROTECTION?</b>`), '',
    `${e('UNLOCK', '🔓')} Your Gmail addresses will be accessible`,
    'without a PIN.', '',
    `<i>${e('INFO', 'ℹ️')} Saved Gmail records will NOT be deleted.</i>`,
  ].join('\n'),

  pinDisabled: () => [
    head(`${e('SUCCESS', '✅')} <b>PIN DISABLED</b>`), '',
    `${e('UNLOCK', '🔓')} PIN protection has been turned off.`,
  ].join('\n'),

  pinProtected: () => [
    head(`${e('SECURITY', '🔐')} <b>PROTECTED</b>`), '',
    `${e('KEY', '🔑')} Enter your security PIN below.`,
  ].join('\n'),

  pinWrong: () => [
    head(`${e('ERROR', '❌')} <b>INCORRECT PIN</b>`), '',
    `${e('WARNING', '⚠️')} Please try again.`,
  ].join('\n'),

  pinLocked: (sec) => {
    const m = Math.ceil(sec / 60);
    return [
      head(`${e('LOCK', '🔒')} <b>TEMPORARILY LOCKED</b>`), '',
      `${e('WARNING', '⚠️')} Too many failed attempts.`,
      `Try again in <b>${m} minute${m > 1 ? 's' : ''}</b>.`,
    ].join('\n');
  },

  pinBadFormat: () => [
    head(`${e('WARNING', '⚠️')} <b>INVALID PIN</b>`), '',
    `${e('ERROR', '❌')} PIN must be ${cfg().pinMin}–${cfg().pinMax} digits.`,
  ].join('\n'),

  account: (u, n) => [
    head(`${e('USER', '👤')} <b>MY ACCOUNT</b>`), '',
    `${e('INFO', 'ℹ️')} <b>Telegram ID</b>`,
    `<code>${u.id}</code>`, '',
    '<b>Username</b>',
    u.username ? `@${esc(u.username)}` : '<i>—</i>', '',
    `${e('MAIL', '📧')} <b>Saved Gmail</b>`,
    String(n), '',
    `${e('LOCK', '🔐')} <b>Security</b>`,
    u.pinEnabled ? `${e('SUCCESS', '🟢')} Enabled` : `${e('WARNING', '⚪')} Disabled`, '',
    `${e('STAR', '✦')} <b>Joined</b>`,
    dateStr(u.createdAt),
  ].join('\n'),

  terms: () => [
    head(`${e('DOC', '📜')} <b>TERMS OF SERVICE</b>`), '',
    `${e('CHECK', '✔️')} <b>1.</b> VEYRO stores only the Gmail addresses you provide.`,
    `${e('LOCK', '🔒')} <b>2.</b> We never ask for or store Gmail passwords or Google credentials.`,
    `${e('WARNING', '⚠️')} <b>3.</b> Data is kept on the server and can be lost on restart/redeploy.`,
    `${e('KEY', '🔑')} <b>4.</b> You are responsible for keeping your Telegram account and PIN secure.`,
    `${e('ERROR', '❌')} <b>5.</b> Misuse may result in access being revoked.`,
    `${e('HEART', '❤️')} <b>6.</b> By using VEYRO, you agree to these terms.`,
  ].join('\n'),

  support: () => [
    head(`${e('SUPPORT', '🆘')} <b>SUPPORT</b>`), '',
    `${e('INFO', 'ℹ️')} Need help?`, '',
    `${e('USER', '👤')} <b>Contact</b>`,
    `<code>${esc(cfg().support ? '@' + cfg().support : '—')}</code>`,
  ].join('\n'),
};

/* ─────────  KEYBOARDS  ───────── */
const K = {
  main: () => [
    [btn('📧  Add Gmail', CB.ADD, 'primary'), btn('📂  My Gmail', CB.LIST, 'primary')],
    [btn('🔐  Security', CB.SEC, 'primary'), btn('👤  My Account', CB.ACC, 'primary')],
    [btn('📜  Terms', CB.TOS), btn('🆘  Support', CB.SUP)],
  ],
  cancel: () => [[btn('✖️  Cancel', CB.MAIN, 'danger')]],
  gmailAdded: () => [
    [btn('📂  My Gmail', CB.LIST, 'primary')],
    [btn('➕  Add Another', CB.ADD, 'success')],
    [btn('◀️  Back', CB.MAIN)],
  ],
  gmailEmpty: () => [
    [btn('➕  Add Gmail', CB.ADD, 'primary')],
    [btn('◀️  Back', CB.MAIN)],
  ],
  gmailList: (emails) => [
    ...emails.map((em, i) => [btn(`📧  ${em}`, CB.view(i), 'primary')]),
    [btn('◀️  Back', CB.MAIN)],
  ],
  gmailDetails: (i) => [
    [btn('🗑  Delete', CB.del(i), 'danger')],
    [btn('◀️  Back', CB.LIST)],
  ],
  gmailDelConfirm: (i) => [
    [btn('✅  Confirm Delete', CB.delOk(i), 'danger')],
    [btn('✖️  Cancel', CB.view(i))],
  ],
  gmailDeleted: () => [
    [btn('📂  My Gmail', CB.LIST, 'primary')],
    [btn('◀️  Back', CB.MAIN)],
  ],
  security: (u) => {
    const r = [];
    if (!u?.pinEnabled) r.push([btn('🔑  Set PIN', CB.pinSet, 'primary')]);
    else {
      r.push([btn('🔄  Change PIN', CB.pinChange, 'primary')]);
      r.push([btn('🔓  Disable PIN', CB.pinDisable, 'danger')]);
    }
    r.push([btn('◀️  Back', CB.MAIN)]);
    return r;
  },
  pinResult: () => [
    [btn('📂  My Gmail', CB.LIST, 'primary')],
    [btn('◀️  Back', CB.MAIN)],
  ],
  protected: () => [[btn('✖️  Cancel', CB.MAIN, 'danger')]],
  pinWrong: () => [
    [btn('🔁  Try Again', CB.pinRetry, 'primary')],
    [btn('◀️  Back', CB.MAIN)],
  ],
  pinDisableConfirm: () => [
    [btn('✅  Disable', CB.pinDisableOk, 'danger')],
    [btn('✖️  Cancel', CB.SEC)],
  ],
  back: () => [[btn('◀️  Back', CB.MAIN)]],
  support: () => [
    [btn('💬  Contact Support', CB.SUP + ':c', 'primary')],
    [btn('◀️  Back', CB.MAIN)],
  ],
};

module.exports = { CB, T, K, kb, esc, stripCustomEmojis };
