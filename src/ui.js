const cfg = () => global.VEYRO;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Emoji IDs that Telegram rejected — permanently blacklist */
const badEmojiIds = new Set();

/* ─────────  ANIMATED CUSTOM EMOJI (text only)  ─────────
 * fallback MUST be a real emoji glyph (not ✦ ★ ✧ etc.)
 * Telegram rejects tg-emoji whose fallback is not an emoji character.
 */
function e(key, fallback) {
  const c = cfg();
  if (!c.useCustomEmojis) return fallback;
  const id = c.emojis[key];
  if (!id || badEmojiIds.has(id)) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

function stripCustomEmojis(text) {
  return String(text).replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/g, '$1');
}

function blacklistEmojisIn(text) {
  const ids = [...String(text).matchAll(/emoji-id="(\d+)"/g)].map(m => m[1]);
  ids.forEach(id => badEmojiIds.add(id));
}

/* ─────────  BUTTONS — NO EMOJIS, ONLY COLORED STYLES  ───────── */
function btn(text, data, style) {
  const b = { text, callback_data: data };
  if (style && cfg().buttonStyles) b.style = style;
  return b;
}
const kb = (rows) => ({ inline_keyboard: rows });

/* ─────────  CALLBACK IDS  ───────── */
const CB = {
  MAIN: 'm', ADD: 'ga', LIST: 'gl', SEC: 'sc', ACC: 'ac', TOS: 'ts', SUP: 'sp',
  view: (i) => `gv:${i}`,
  del: (i) => `gd:${i}`,
  delOk: (i) => `gdx:${i}`,
  reveal: (i) => `gr:${i}`,
  hide: (i) => `gh:${i}`,
  pinSet: 'ps', pinChange: 'pc', pinDisable: 'pd', pinDisableOk: 'pdx', pinRetry: 'prt',
};

/* ─────────  HELPERS  ───────── */
const dateStr = (ts) => { try { return new Date(ts).toISOString().slice(0, 10); } catch { return '—'; } };
const maskPassword = () => '••••••••';

/* ─────────  TEXTS — SHORT, CLEAN, ANIMATED EMOJIS  ───────── */
const T = {
  welcome: () => [
    `${e('STAR', '⭐')} <b>VEYRO</b>`, '',
    `${e('SPARKLE', '✨')} Welcome.`, '',
    `${e('MAIL', '📧')} Manage your saved Gmail`,
    `${e('LOCK', '🔐')} accounts securely.`,
  ].join('\n'),

  gmailAddEmail: () => [
    `${e('MAIL', '📧')} <b>ADD GMAIL</b>`, '',
    'Enter the Gmail address',
    'you want to save.',
  ].join('\n'),

  gmailAddPassword: (email) => [
    `${e('KEY', '🔑')} <b>ADD PASSWORD</b>`, '',
    `${e('MAIL', '📧')} <code>${esc(email)}</code>`, '',
    'Enter the password.',
    `<i>${e('LOCK', '🔒')} Encrypted with AES-256-GCM.</i>`,
  ].join('\n'),

  gmailAdded: (email) => [
    `${e('SUCCESS', '✅')} <b>GMAIL SAVED</b>`, '',
    `${e('MAIL', '📧')} <code>${esc(email)}</code>`, '',
    `${e('LOCK', '🔐')} Password encrypted.`,
  ].join('\n'),

  gmailInvalid: () => [
    `${e('WARNING', '⚠️')} <b>INVALID GMAIL</b>`, '',
    `${e('ERROR', '❌')} That is not a valid address.`, '',
    'Example: <code>example@gmail.com</code>',
  ].join('\n'),

  gmailPwdInvalid: () => [
    `${e('WARNING', '⚠️')} <b>INVALID PASSWORD</b>`, '',
    `${e('ERROR', '❌')} Password must be 1–200 characters.`,
  ].join('\n'),

  gmailDup: () => [
    `${e('WARNING', '⚠️')} <b>ALREADY SAVED</b>`, '',
    `${e('INFO', 'ℹ️')} This Gmail is already in your list.`,
  ].join('\n'),

  gmailList: (emails) => emails.length
    ? [
        `${e('FOLDER', '📂')} <b>MY GMAIL</b>`, '',
        `${e('MAIL', '📧')} ${emails.length} account${emails.length > 1 ? 's' : ''} saved.`, '',
        '<i>Tap to view details.</i>',
      ].join('\n')
    : [
        `${e('FOLDER', '📂')} <b>MY GMAIL</b>`, '',
        `${e('INFO', 'ℹ️')} No Gmail added yet.`,
      ].join('\n'),

  gmailDetails: (entry, showPwd, plainPwd) => {
    const lines = [
      `${e('MAIL', '📧')} <b>GMAIL DETAILS</b>`, '',
      `${e('INFO', 'ℹ️')} <b>Email</b>`,
      `<code>${esc(entry.email)}</code>`, '',
    ];
    if (entry.passwordEnc) {
      lines.push(`${e('KEY', '🔑')} <b>Password</b>`);
      lines.push(showPwd && plainPwd ? `<code>${esc(plainPwd)}</code>` : `<code>${maskPassword()}</code>`);
    } else {
      lines.push(`<i>${e('WARNING', '⚠️')} No password stored.</i>`);
    }
    return lines.join('\n');
  },

  gmailDel: (email) => [
    `${e('WARNING', '⚠️')} <b>DELETE GMAIL</b>`, '',
    'Remove this account?', '',
    `${e('MAIL', '📧')} <code>${esc(email)}</code>`, '',
    `<i>Password will also be deleted.</i>`,
  ].join('\n'),

  gmailDelOk: () => [
    `${e('SUCCESS', '✅')} <b>REMOVED</b>`, '',
    `${e('CHECK', '✔️')} Gmail and password removed.`,
  ].join('\n'),

  security: (u) => [
    `${e('SECURITY', '🔐')} <b>SECURITY</b>`, '',
    `${e('LOCK', '🔒')} Protect your Gmail with a PIN.`, '',
    `<b>Status:</b> ${u?.pinEnabled ? 'Enabled' : 'Disabled'}`,
  ].join('\n'),

  pinSetPrompt: () => [
    `${e('SECURITY', '🔐')} <b>SET PIN</b>`, '',
    `${e('KEY', '🔑')} Send your PIN in the chat.`, '',
    `<i>${cfg().pinMin}–${cfg().pinMax} digits.</i>`,
  ].join('\n'),

  pinEnabled: () => [
    `${e('SUCCESS', '✅')} <b>PIN ENABLED</b>`, '',
    `${e('LOCK', '🔒')} Your data is now protected.`,
  ].join('\n'),

  pinChangeCurrent: () => [
    `${e('REFRESH', '🔄')} <b>CHANGE PIN</b>`, '',
    `${e('KEY', '🔑')} Send your current PIN.`,
  ].join('\n'),

  pinChangeNew: () => [
    `${e('KEY', '🔑')} <b>NEW PIN</b>`, '',
    `Send your new PIN (${cfg().pinMin}–${cfg().pinMax} digits).`,
  ].join('\n'),

  pinChanged: () => [
    `${e('SUCCESS', '✅')} <b>PIN UPDATED</b>`, '',
    `${e('CHECK', '✔️')} Your PIN has been changed.`,
  ].join('\n'),

  pinDisableCurrent: () => [
    `${e('UNLOCK', '🔓')} <b>DISABLE PIN</b>`, '',
    `${e('KEY', '🔑')} Send your current PIN.`,
  ].join('\n'),

  pinDisableConfirm: () => [
    `${e('WARNING', '⚠️')} <b>DISABLE PROTECTION?</b>`, '',
    `${e('UNLOCK', '🔓')} Your Gmail will be accessible`,
    'without a PIN.', '',
    `<i>Your Gmail records will NOT be deleted.</i>`,
  ].join('\n'),

  pinDisabled: () => [
    `${e('SUCCESS', '✅')} <b>PIN DISABLED</b>`, '',
    `${e('UNLOCK', '🔓')} Protection turned off.`,
  ].join('\n'),

  pinProtected: () => [
    `${e('SECURITY', '🔐')} <b>PROTECTED</b>`, '',
    `${e('KEY', '🔑')} Send your security PIN.`,
  ].join('\n'),

  pinWrong: () => [
    `${e('ERROR', '❌')} <b>INCORRECT PIN</b>`, '',
    `${e('WARNING', '⚠️')} Please try again.`,
  ].join('\n'),

  pinLocked: (sec) => {
    const m = Math.ceil(sec / 60);
    return [
      `${e('LOCK', '🔒')} <b>TEMPORARILY LOCKED</b>`, '',
      `${e('WARNING', '⚠️')} Too many failed attempts.`,
      `Try again in ${m} minute${m > 1 ? 's' : ''}.`,
    ].join('\n');
  },

  pinBadFormat: () => [
    `${e('WARNING', '⚠️')} <b>INVALID PIN</b>`, '',
    `${e('ERROR', '❌')} PIN must be ${cfg().pinMin}–${cfg().pinMax} digits.`,
  ].join('\n'),

  account: (u, n) => [
    `${e('USER', '👤')} <b>MY ACCOUNT</b>`, '',
    `${e('INFO', 'ℹ️')} <b>Telegram ID</b>`,
    `<code>${u.id}</code>`, '',
    '<b>Username</b>',
    u.username ? `@${esc(u.username)}` : '—', '',
    `${e('MAIL', '📧')} <b>Saved Gmail</b>`,
    String(n), '',
    `${e('LOCK', '🔐')} <b>Security</b>`,
    u.pinEnabled ? 'Enabled' : 'Disabled', '',
    `${e('STAR', '⭐')} <b>Joined</b>`,
    dateStr(u.createdAt),
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

  support: () => [
    `${e('SUPPORT', '🆘')} <b>SUPPORT</b>`, '',
    `${e('INFO', 'ℹ️')} Need help?`, '',
    `${e('USER', '👤')} <b>Contact</b>`,
    `<code>${esc(cfg().support ? '@' + cfg().support : '—')}</code>`,
  ].join('\n'),
};

/* ─────────  KEYBOARDS — CLEAN, COLORED, NO EMOJIS  ───────── */
const K = {
  main: () => [
    [btn('Add Gmail', CB.ADD, 'primary'), btn('My Gmail', CB.LIST, 'primary')],
    [btn('Security', CB.SEC, 'primary'), btn('My Account', CB.ACC, 'primary')],
    [btn('Terms', CB.TOS, 'primary'), btn('Support', CB.SUP, 'primary')],
  ],
  cancel: () => [[btn('Cancel', CB.MAIN, 'danger')]],
  gmailAdded: () => [
    [btn('My Gmail', CB.LIST, 'primary')],
    [btn('Add Another', CB.ADD, 'success')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  gmailEmpty: () => [
    [btn('Add Gmail', CB.ADD, 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  gmailList: (emails) => [
    ...emails.map((em, i) => [btn(em, CB.view(i), 'primary')]),
    [btn('Back', CB.MAIN, 'primary')],
  ],
  gmailDetails: (i, hasPwd, shown) => {
    const rows = [];
    if (hasPwd) {
      rows.push([
        shown
          ? btn('Hide Password', CB.hide(i), 'primary')
          : btn('Show Password', CB.reveal(i), 'success'),
      ]);
    }
    rows.push([btn('Delete', CB.del(i), 'danger')]);
    rows.push([btn('Back', CB.LIST, 'primary')]);
    return rows;
  },
  gmailDelConfirm: (i) => [
    [btn('Confirm Delete', CB.delOk(i), 'danger')],
    [btn('Cancel', CB.view(i), 'primary')],
  ],
  gmailDeleted: () => [
    [btn('My Gmail', CB.LIST, 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  security: (u) => {
    const r = [];
    if (!u?.pinEnabled) r.push([btn('Set PIN', CB.pinSet, 'success')]);
    else {
      r.push([btn('Change PIN', CB.pinChange, 'primary')]);
      r.push([btn('Disable PIN', CB.pinDisable, 'danger')]);
    }
    r.push([btn('Back', CB.MAIN, 'primary')]);
    return r;
  },
  pinResult: () => [
    [btn('My Gmail', CB.LIST, 'primary')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  protected: () => [[btn('Cancel', CB.MAIN, 'danger')]],
  pinWrong: () => [
    [btn('Try Again', CB.pinRetry, 'success')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
  pinDisableConfirm: () => [
    [btn('Disable', CB.pinDisableOk, 'danger')],
    [btn('Cancel', CB.SEC, 'primary')],
  ],
  back: () => [[btn('Back', CB.MAIN, 'primary')]],
  support: () => [
    [btn('Contact Support', CB.SUP + ':c', 'success')],
    [btn('Back', CB.MAIN, 'primary')],
  ],
};

module.exports = { CB, T, K, kb, esc, stripCustomEmojis, blacklistEmojisIn };
