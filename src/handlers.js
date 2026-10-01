const { CB, T, K, kb, stripCustomEmojis, blacklistEmojisIn } = require('./ui');
const S = require('./services');
const cfg = () => global.VEYRO;

/* ─────────  SESSIONS  ───────── */
const sessions = new Map();
const sess = (id) => {
  if (!sessions.has(id)) sessions.set(id, { state: 'idle', data: {}, chatId: null, msgId: null });
  return sessions.get(id);
};
const setState = (id, state, data = {}) => { const s = sess(id); s.state = state; s.data = data; return s; };

/* ─────────  SAFE REPLY/EDIT  ───────── */
function isEntityError(err) { return /ENTITY_TEXT_INVALID|can't parse entities|unsupported start tag/i.test(err?.description || err?.message || ''); }
const OPTS = (keyboard) => ({ parse_mode: 'HTML', reply_markup: kb(keyboard), link_preview_options: { is_disabled: true } });

async function safeReply(ctx, text, keyboard) {
  try { return await ctx.reply(text, OPTS(keyboard)); }
  catch (err) {
    if (!isEntityError(err)) throw err;
    blacklistEmojisIn(text);
    return await ctx.reply(stripCustomEmojis(text), OPTS(keyboard));
  }
}
async function safeEdit(ctx, chatId, msgId, text, keyboard) {
  try { return await ctx.telegram.editMessageText(chatId, msgId, undefined, text, OPTS(keyboard)); }
  catch (err) {
    if (/message is not modified/i.test(err?.description || '')) return;
    if (!isEntityError(err)) throw err;
    blacklistEmojisIn(text);
    return await ctx.telegram.editMessageText(chatId, msgId, undefined, stripCustomEmojis(text), OPTS(keyboard));
  }
}

/* Bulletproof editUI — always works */
async function editUI(ctx, text, keyboard) {
  const s = sess(ctx.from.id);
  if (!s.chatId || !s.msgId) {
    const m = await safeReply(ctx, text, keyboard);
    s.chatId = m.chat.id; s.msgId = m.message_id;
    return;
  }
  try {
    await safeEdit(ctx, s.chatId, s.msgId, text, keyboard);
  } catch (e) {
    console.warn('[editUI] edit failed, sending fresh:', e?.description || e);
    try { await ctx.telegram.deleteMessage(s.chatId, s.msgId); } catch (_) {}
    const m = await safeReply(ctx, text, keyboard);
    s.chatId = m.chat.id; s.msgId = m.message_id;
  }
}

async function answer(ctx) { try { await ctx.answerCbQuery(); } catch (_) {} }
async function delUserMsg(ctx) { try { await ctx.deleteMessage(); } catch (_) {} }

/* ─────────  FORCE JOIN  ───────── */
async function checkChannels(bot, userId) {
  const chans = await S.listChannels();
  if (!chans.length) return { ok: true, missing: [] };
  const missing = [];
  for (const c of chans) {
    try {
      const m = await bot.telegram.getChatMember(`@${c.username}`, userId);
      if (['left', 'kicked'].includes(m.status)) missing.push(c);
    } catch (e) {
      console.warn(`[FORCE-JOIN] ${c.username}: ${e.description || e.message}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

async function showForceJoin(ctx, missing) {
  return editUI(ctx, T.forceJoin(missing), K.forceJoin(missing));
}

/* ─────────  MAIN MENU  ───────── */
async function showMain(ctx) {
  const isAdmin = cfg().admins.includes(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.welcome(), K.main(isAdmin));
}

/* ─────────  RENDERERS  ───────── */
async function renderGmailList(ctx) {
  const emails = await S.listGmails(ctx.from.id);
  const list = emails.map(e => e.email);
  if (!list.length) return editUI(ctx, T.gmailList([]), K.gmailEmpty());
  return editUI(ctx, T.gmailList(list), K.gmailList(list));
}
async function renderGmailDetails(ctx, idx, show) {
  const entry = await S.getGmail(ctx.from.id, idx);
  if (!entry) return renderGmailList(ctx);
  const plain = show ? S.revealPassword(entry) : null;
  return editUI(ctx, T.gmailDetails(entry, show, plain), K.gmailDetails(idx, !!entry.passwordEnc, show));
}
async function renderSecurity(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.security(u), K.security(u));
}
async function withPin(ctx, next) {
  const u = await S.getUser(ctx.from.id);
  if (!u?.pinEnabled) return next(ctx);
  setState(ctx.from.id, 'pin_verify', { next });
  return editUI(ctx, T.pinProtected(), K.protected());
}

/* ─────────  ADMIN RENDERERS  ───────── */
async function renderAdmin(ctx) {
  const [u, c] = await Promise.all([S.countUsers(), S.countChannels()]);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.adminMain(u, c), K.adminMain());
}
async function renderChannelList(ctx) {
  const list = await S.listChannels();
  return editUI(ctx, T.adminListChannels(list), K.adminBack());
}
async function renderRemovePick(ctx) {
  const list = await S.listChannels();
  if (!list.length) return editUI(ctx, T.adminListChannels(list), K.adminBack());
  return editUI(ctx, T.adminRemovePick(), K.adminRemoveList(list));
}

/* ─────────  TEXT HANDLER  ───────── */
async function handleText(ctx, bot) {
  const s = sess(ctx.from.id);
  const text = (ctx.message.text || '').trim();
  const isAdmin = cfg().admins.includes(ctx.from.id);

  switch (s.state) {
    case 'gmail_add_email': {
      await delUserMsg(ctx);
      if (!S.validGmail(text)) return editUI(ctx, T.gmailInvalid(), K.cancel());
      setState(ctx.from.id, 'gmail_add_password', { email: text.toLowerCase() });
      return editUI(ctx, T.gmailAddPassword(text.toLowerCase()), K.cancel());
    }
    case 'gmail_add_password': {
      await delUserMsg(ctx);
      if (!S.validPassword(text)) return editUI(ctx, T.gmailPwdInvalid(), K.cancel());
      const email = s.data.email;
      const r = await S.addGmail(ctx.from.id, email, text);
      setState(ctx.from.id, 'idle');
      if (!r.ok) return editUI(ctx, T.gmailDup(), K.cancel());
      return editUI(ctx, T.gmailAdded(r.email), K.gmailAdded());
    }
    case 'pin_set': {
      await delUserMsg(ctx);
      if (!S.validPin(text, cfg().pinMin, cfg().pinMax)) return editUI(ctx, T.pinBadFormat(), K.cancel());
      await S.setPin(ctx.from.id, text);
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.pinEnabled(), K.pinResult());
    }
    case 'pin_change_current': {
      await delUserMsg(ctx);
      const r = await S.verifyPin(ctx.from.id, text);
      if (!r.ok) { setState(ctx.from.id, 'idle'); return editUI(ctx, r.reason === 'locked' ? T.pinLocked(r.remaining) : T.pinWrong(), r.reason === 'locked' ? K.back() : K.pinWrong()); }
      setState(ctx.from.id, 'pin_change_new');
      return editUI(ctx, T.pinChangeNew(), K.cancel());
    }
    case 'pin_change_new': {
      await delUserMsg(ctx);
      if (!S.validPin(text, cfg().pinMin, cfg().pinMax)) return editUI(ctx, T.pinBadFormat(), K.cancel());
      await S.setPin(ctx.from.id, text);
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.pinChanged(), K.pinResult());
    }
    case 'pin_disable_current': {
      await delUserMsg(ctx);
      const r = await S.verifyPin(ctx.from.id, text);
      if (!r.ok) { setState(ctx.from.id, 'idle'); return editUI(ctx, r.reason === 'locked' ? T.pinLocked(r.remaining) : T.pinWrong(), r.reason === 'locked' ? K.back() : K.pinWrong()); }
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.pinDisableConfirm(), K.pinDisableConfirm());
    }
    case 'pin_verify': {
      await delUserMsg(ctx);
      const r = await S.verifyPin(ctx.from.id, text);
      if (!r.ok) { setState(ctx.from.id, 'idle'); return editUI(ctx, r.reason === 'locked' ? T.pinLocked(r.remaining) : T.pinWrong(), r.reason === 'locked' ? K.back() : K.pinWrong()); }
      const next = s.data?.next || renderGmailList;
      setState(ctx.from.id, 'idle');
      return next(ctx);
    }
    case 'admin_add_channel': {
      await delUserMsg(ctx);
      const uname = text.replace(/^@/, '').trim();
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(uname)) {
        return editUI(ctx, T.adminAddFail('Invalid username format.'), K.adminBack());
      }
      try {
        const chat = await bot.telegram.getChat(`@${uname}`);
        if (!chat?.title) throw new Error('Not a valid channel.');
        const me = await bot.telegram.getChatMember(`@${uname}`, bot.botInfo.id);
        if (!['administrator', 'creator'].includes(me.status)) {
          return editUI(ctx, T.adminAddFail('Bot must be an admin in that channel.'), K.adminBack());
        }
        const r = await S.addChannel(uname, chat.title);
        setState(ctx.from.id, 'idle');
        if (!r.ok) return editUI(ctx, T.adminAddFail('Channel already added.'), K.adminBack());
        return editUI(ctx, T.adminAddOk(uname, chat.title), K.adminAddOk());
      } catch (e) {
        return editUI(ctx, T.adminAddFail(e.description || e.message), K.adminBack());
      }
    }
    case 'admin_broadcast': {
      await delUserMsg(ctx);
      if (!isAdmin) return showMain(ctx);
      const ids = await S.listAllUserIds();
      let ok = 0, fail = 0;
      for (const uid of ids) {
        try { await bot.telegram.sendMessage(uid, text, { parse_mode: 'HTML' }); ok++; }
        catch (_) { fail++; }
      }
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.adminBroadcastResult(ok, fail), K.adminBroadcastResult());
    }
    default: return;
  }
}

/* ─────────  REGISTER  ───────── */
function register(bot) {
  bot.start(async (ctx) => {
    try {
      await S.upsertUser(ctx.from);
      const chk = await checkChannels(bot, ctx.from.id);
      if (!chk.ok) {
        const m = await ctx.reply(T.forceJoin(chk.missing), OPTS(K.forceJoin(chk.missing)));
        const s = sess(ctx.from.id);
        s.chatId = m.chat.id; s.msgId = m.message_id; s.state = 'idle';
        return;
      }
      const isAdmin = cfg().admins.includes(ctx.from.id);
      const m = await ctx.reply(T.welcome(), OPTS(K.main(isAdmin)));
      const s = sess(ctx.from.id);
      s.chatId = m.chat.id; s.msgId = m.message_id; s.state = 'idle';
    } catch (e) { console.error('[start]', e?.description || e); }
  });

  bot.on('text', async (ctx) => {
    const s = sess(ctx.from.id);
    if (s.state && s.state !== 'idle') return handleText(ctx, bot);
    if (ctx.message.text?.startsWith('/') && ctx.message.text !== '/start') {
      try { await ctx.deleteMessage(); } catch (_) {}
    }
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const isAdmin = cfg().admins.includes(ctx.from.id);
    try {
      await answer(ctx);

      if (data === CB.MAIN) return showMain(ctx);

      if (data === CB.VERIFY) {
        const chk = await checkChannels(bot, ctx.from.id);
        if (!chk.ok) return editUI(ctx, T.forceJoinFail(chk.missing), K.forceJoinFail(chk.missing));
        return showMain(ctx);
      }

      if (data === CB.ADD) { setState(ctx.from.id, 'gmail_add_email'); return editUI(ctx, T.gmailAddEmail(), K.cancel()); }
      if (data === CB.LIST) return withPin(ctx, renderGmailList);

      if (data.startsWith('gv:')) return renderGmailDetails(ctx, Number(data.slice(3)), false);
      if (data.startsWith('gr:')) return renderGmailDetails(ctx, Number(data.slice(3)), true);
      if (data.startsWith('gh:')) return renderGmailDetails(ctx, Number(data.slice(3)), false);
      if (data.startsWith('gd:')) {
        const i = Number(data.slice(3));
        const entry = await S.getGmail(ctx.from.id, i);
        if (!entry) return renderGmailList(ctx);
        return editUI(ctx, T.gmailDel(entry.email), K.gmailDelConfirm(i));
      }
      if (data.startsWith('gdx:')) {
        const i = Number(data.slice(4));
        const entry = await S.getGmail(ctx.from.id, i);
        if (!entry) return renderGmailList(ctx);
        await S.deleteGmail(ctx.from.id, entry.email);
        return editUI(ctx, T.gmailDelOk(), K.gmailDeleted());
      }

      if (data === CB.SEC) return renderSecurity(ctx);
      if (data === CB.pinSet) { setState(ctx.from.id, 'pin_set'); return editUI(ctx, T.pinSetPrompt(), K.cancel()); }
      if (data === CB.pinChange) { setState(ctx.from.id, 'pin_change_current'); return editUI(ctx, T.pinChangeCurrent(), K.cancel()); }
      if (data === CB.pinDisable) { setState(ctx.from.id, 'pin_disable_current'); return editUI(ctx, T.pinDisableCurrent(), K.cancel()); }
      if (data === CB.pinDisableOk) { await S.disablePin(ctx.from.id); setState(ctx.from.id, 'idle'); return editUI(ctx, T.pinDisabled(), K.pinResult()); }
      if (data === CB.pinRetry) { setState(ctx.from.id, 'pin_verify', { next: renderGmailList }); return editUI(ctx, T.pinProtected(), K.protected()); }

      if (data === CB.ACC) {
        const u = await S.getUser(ctx.from.id);
        const n = await S.countGmails(ctx.from.id);
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.account(u, n), K.back());
      }
      if (data === CB.TOS) { setState(ctx.from.id, 'idle'); return editUI(ctx, T.terms(), K.back()); }
      if (data === CB.SUP) { setState(ctx.from.id, 'idle'); return editUI(ctx, T.support(), K.support()); }
      if (data === CB.SUP + ':c') return;

      /* ADMIN */
      if (!isAdmin) return;
      if (data === CB.ADMIN) return renderAdmin(ctx);
      if (data === CB.ADM_ADD) { setState(ctx.from.id, 'admin_add_channel'); return editUI(ctx, T.adminAddChannel(), K.adminBack()); }
      if (data === CB.ADM_LIST) return renderChannelList(ctx);
      if (data === CB.ADM_REMOVE) return renderRemovePick(ctx);
      if (data === CB.ADM_BC) { setState(ctx.from.id, 'admin_broadcast'); return editUI(ctx, T.adminBroadcast(), K.adminBack()); }
      if (data.startsWith('arx:')) {
        const uname = data.slice(4);
        const list = await S.listChannels();
        const c = list.find(x => x.username === uname);
        if (!c) return renderRemovePick(ctx);
        return editUI(ctx, T.adminRemoveConfirm(c), K.adminRemoveConfirm(uname));
      }
      if (data.startsWith('aro:')) {
        const uname = data.slice(4);
        await S.removeChannel(uname);
        return editUI(ctx, T.adminRemoveOk(), K.adminRemoveOk());
      }
    } catch (e) {
      console.error('[callback]', e?.description || e);
      try { await ctx.answerCbQuery('Error'); } catch (_) {}
    }
  });
}

module.exports = { register };
