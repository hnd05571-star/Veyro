const cfg = () => global.VEYRO;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Kept for compatibility with handlers.js — no-op now */
function stripCustomEmojis(text) { return String(text); }
function blacklistEmojisIn(_text) {}

/* ─────────  BUTTONS  ───────── */
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

/* ─────────  TEXTS  ───────── */
const T = {
  welcome: () => [
    '<b>VEYRO</b>', '',
    'Welcome.',
    '',
    'Manage your saved Gmail',
    'accounts securely.',
  ].join('\n'),

  gmailAddEmail: () => [
    '<b>ADD GMAIL</b>', '',
    'Enter the Gmail address',
    'you want to save.',
  ].join('\n'),

  gmailAddPassword: (email) => [
    '<b>ADD PASSWORD</b>', '',
    `<code>${esc(email)}</code>`, '',
    'Enter the password.',
    '<i>Encrypted with AES-256-GCM.</i>',
  ].join('\n'),

  gmailAdded: (email) => [
    '<b>GMAIL SAVED</b>', '',
    `<code>${esc(email)}</code>`, '',
    'Password encrypted.',
  ].join('\n'),

  gmailInvalid: () => [
    '<b>INVALID GMAIL</b>', '',
    'That is not a valid address.', '',
    'Example: <code>example@gmail.com</code>',
  ].join('\n'),

  gmailPwdInvalid: () => [
    '<b>INVALID PASSWORD</b>', '',
    'Password must be 1–200 characters.',
  ].join('\n'),

  gmailDup: () => [
    '<b>ALREADY SAVED</b>', '',
    'This Gmail is already in your list.',
  ].join('\n'),

  gmailList: (emails) => emails.length
    ? [
        '<b>MY GMAIL</b>', '',
        `${emails.length} account${emails.length > 1 ? 's' : ''} saved.`, '',
        'Tap to view details.',
      ].join('\n')
    : [
        '<b>MY GMAIL</b>', '',
        'No Gmail added yet.',
      ].join('\n'),

  gmailDetails: (entry, showPwd, plainPwd) => {
    const lines = [
      '<b>GMAIL DETAILS</b>', '',
      '<b>Email</b>',
      `<code>${esc(entry.email)}</code>`, '',
    ];
    if (entry.passwordEnc) {
      lines.push('<b>Password</b>');
      lines.push(showPwd && plainPwd ? `<code>${esc(plainPwd)}</code>` : `<code>${maskPassword()}</code>`);
    } else {
      lines.push('<i>No password stored.</i>');
    }
    return lines.join('\n');
  },

  gmailDel: (email) => [
    '<b>DELETE GMAIL</b>', '',
    'Remove this account?', '',
    `<code>${esc(email)}</code>`, '',
    '<i>Password will also be deleted.</i>',
  ].join('\n'),

  gmailDelOk: () => [
    '<b>REMOVED</b>', '',
    'Gmail and password removed.',
  ].join('\n'),

  security: (u) => [
    '<b>SECURITY</b>', '',
    'Protect your Gmail with a PIN.', '',
    `<b>Status:</b> ${u?.pinEnabled ? 'Enabled' : 'Disabled'}`,
  ].join('\n'),

  pinSetPrompt: () => [
    '<b>SET PIN</b>', '',
    'Send your PIN in the chat.', '',
    `<i>${cfg().pinMin}–${cfg().pinMax} digits.</i>`,
  ].join('\n'),

  pinEnabled: () => [
    '<b>PIN ENABLED</b>', '',
    'Your data is now protected.',
  ].join('\n'),

  pinChangeCurrent: () => [
    '<b>CHANGE PIN</b>', '',
    'Send your current PIN.',
  ].join('\n'),

  pinChangeNew: () => [
    '<b>NEW PIN</b>', '',
    `Send your new PIN (${cfg().pinMin}–${cfg().pinMax} digits).`,
  ].join('\n'),

  pinChanged: () => [
    '<b>PIN UPDATED</b>', '',
    'Your PIN has been changed.',
  ].join('\n'),

  pinDisableCurrent: () => [
    '<b>DISABLE PIN</b>', '',
    'Send your current PIN.',
  ].join('\n'),

  pinDisableConfirm: () => [
    '<b>DISABLE PROTECTION?</b>', '',
    'Your Gmail will be accessible',
    'without a PIN.', '',
    '<i>Your Gmail records will NOT be deleted.</i>',
  ].join('\n'),

  pinDisabled: () => [
    '<b>PIN DISABLED</b>', '',
    'Protection turned off.',
  ].join('\n'),

  pinProtected: () => [
    '<b>PROTECTED</b>', '',
    'Send your security PIN.',
  ].join('\n'),

  pinWrong: () => [
    '<b>INCORRECT PIN</b>', '',
    'Please try again.',
  ].join('\n'),

  pinLocked: (sec) => {
    const m = Math.ceil(sec / 60);
    return [
      '<b>TEMPORARILY LOCKED</b>', '',
      'Too many failed attempts.',
      `Try again in ${m} minute${m > 1 ? 's' : ''}.`,
    ].join('\n');
  },

  pinBadFormat: () => [
    '<b>INVALID PIN</b>', '',
    `PIN must be ${cfg().pinMin}–${cfg().pinMax} digits.`,
  ].join('\n'),

  account: (u, n) => [
    '<b>MY ACCOUNT</b>', '',
    '<b>Telegram ID</b>',
    `<code>${u.id}</code>`, '',
    '<b>Username</b>',
    u.username ? `@${esc(u.username)}` : '—', '',
    '<b>Saved Gmail</b>',
    String(n), '',
    '<b>Security</b>',
    u.pinEnabled ? 'Enabled' : 'Disabled', '',
    '<b>Joined</b>',
    dateStr(u.createdAt),
  ].join('\n'),

  terms: () => [
    '<b>TERMS OF SERVICE</b>', '',
    '<b>1.</b> VEYRO stores Gmail addresses and passwords you provide.',
    '<b>2.</b> Passwords are encrypted with AES-256-GCM.',
    '<b>3.</b> Data may be lost on server restart or redeploy.',
    '<b>4.</b> You are responsible for your Telegram account and PIN.',
    '<b>5.</b> Misuse may result in access being revoked.',
    '<b>6.</b> By using VEYRO, you agree to these terms.',
  ].join('\n'),

  support: () => [
    '<b>SUPPORT</b>', '',
    'Need help?', '',
    '<b>Contact</b>',
    `<code>${esc(cfg().support ? '@' + cfg().support : '—')}</code>`,
  ].join('\n'),
};

/* ─────────  KEYBOARDS — clean, colored, no emojis  ───────── */
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
    if (!u?.pinEnabled) {
      r.push([btn('Set PIN', CB.pinSet, 'success')]);
    } else {
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
