const { CB, T, K, kb, stripCustomEmojis, blacklistEmojisIn } = require('./ui');
const S = require('./services');
const cfg = () => global.VEYRO;

const sessions = new Map();
const sess = (id) => {
  if (!sessions.has(id)) sessions.set(id, { state: 'idle', data: {}, chatId: null, msgId: null });
  return sessions.get(id);
};
const setState = (id, state, data = {}) => { const s = sess(id); s.state = state; s.data = data; return s; };

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
async function editUI(ctx, text, keyboard) {
  const s = sess(ctx.from.id);
  if (!s.chatId || !s.msgId) {
    const m = await safeReply(ctx, text, keyboard);
    s.chatId = m.chat.id; s.msgId = m.message_id; return;
  }
  try { await safeEdit(ctx, s.chatId, s.msgId, text, keyboard); }
  catch (e) {
    try { await ctx.telegram.deleteMessage(s.chatId, s.msgId); } catch (_) {}
    const m = await safeReply(ctx, text, keyboard);
    s.chatId = m.chat.id; s.msgId = m.message_id;
  }
}
async function answer(ctx, txt) { try { await ctx.answerCbQuery(txt); } catch (_) {} }
async function delUserMsg(ctx) { try { await ctx.deleteMessage(); } catch (_) {} }

/* ─────────  FORCE JOIN  ───────── */
async function checkChannels(bot, userId) {
  const chans = await S.listChannels();
  if (!chans.length) return { ok: true, missing: [] };
  const missing = [];
  for (const c of chans) {
    if (c.isPrivate) { missing.push(c); continue; }
    try {
      const m = await bot.telegram.getChatMember(`@${c.username}`, userId);
      if (['left', 'kicked'].includes(m.status)) missing.push(c);
    } catch (err) {
      // Can't verify — add to list so user still sees the join button
      console.warn(`[FJ] ${c.username}:`, err.description || err.message);
      missing.push({ ...c, unverifiable: true });
    }
  }
  return { ok: !missing.length, missing };
}

/* ─────────  RENDERERS  ───────── */
async function showMain(ctx) {
  const isAdmin = cfg().admins.includes(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.welcome(), K.main(isAdmin));
}
async function renderProfile(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.profile(u), K.back());
}
async function renderRefer(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.refer(u, cfg().botUsername), K.refer(u, cfg().botUsername));
}
async function renderStars(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.starsShop(u, S.STAR_PACKS), K.starsShop(S.STAR_PACKS));
}
async function renderPremium(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.premium(u, S.PREMIUM_PLANS), K.premium(S.PREMIUM_PLANS));
}
async function renderWithdraw(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.withdraw(u), K.withdraw());
}
async function renderWithdrawList(ctx) {
  const list = await S.listWithdrawalsByUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.withdrawList(list), K.withdrawOk());
}

async function renderAdmin(ctx) {
  const [u, c, wd, sr] = await Promise.all([S.countUsers(), S.countChannels(), S.countPendingWithdrawals(), S.countPendingStarRequests()]);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.adminMain(u, c, wd, sr), K.adminMain());
}
async function renderChannelList(ctx) { return editUI(ctx, T.adminListChannels(await S.listChannels()), K.adminBack()); }
async function renderRemovePick(ctx) {
  const list = await S.listChannels();
  if (!list.length) return editUI(ctx, T.adminListChannels(list), K.adminBack());
  return editUI(ctx, T.adminRemovePick(), K.adminRemoveList(list));
}
async function renderWDPick(ctx) {
  const list = await S.listPendingWithdrawals();
  return editUI(ctx, T.adminWDPick(list), K.adminWDList(list));
}
async function renderSRPick(ctx) {
  const list = await S.listPendingStarRequests();
  return editUI(ctx, T.adminSRPick(list), K.adminSRList(list));
}

/* ─────────  PREMIUM LOADING ANIMATION  ───────── */
async function playLoading(ctx, chatId, msgId, finalText, finalKb, task) {
  const frames = [
    '▰▱▱▱▱▱▱▱▱▱  10%',
    '▰▰▱▱▱▱▱▱▱▱  20%',
    '▰▰▰▱▱▱▱▱▱▱  30%',
    '▰▰▰▰▱▱▱▱▱▱  40%',
    '▰▰▰▰▰▱▱▱▱▱  50%',
    '▰▰▰▰▰▰▱▱▱▱  60%',
    '▰▰▰▰▰▰▰▱▱▱  70%',
    '▰▰▰▰▰▰▰▰▱▱  80%',
    '▰▰▰▰▰▰▰▰▰▱  90%',
    '▰▰▰▰▰▰▰▰▰▰  100%',
  ];
  for (const frame of frames) {
    try { await ctx.telegram.editMessageText(chatId, msgId, undefined, T.premiumProcessing(frame), { parse_mode: 'HTML' }); } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  const result = await task();
  await safeEdit(ctx, chatId, msgId, result.text, result.kb);
}

/* ─────────  TEXT HANDLER  ───────── */
async function handleText(ctx, bot) {
  const s = sess(ctx.from.id);
  const text = (ctx.message.text || '').trim();
  const isAdmin = cfg().admins.includes(ctx.from.id);

  switch (s.state) {
    case 'admin_add_channel': {
      await delUserMsg(ctx);
      const parsed = S.parseChannelInput(text);
      if (!parsed) return editUI(ctx, T.adminAddFail('Invalid link or username.'), K.adminBack());

      let title = parsed.isPrivate ? 'Private Channel' : parsed.username;
      if (!parsed.isPrivate) {
        try {
          const chat = await bot.telegram.getChat(`@${parsed.username}`);
          if (chat?.title) title = chat.title;
        } catch (_) {}
      }
      const r = await S.addChannel(parsed.username, title, parsed.isPrivate);
      setState(ctx.from.id, 'idle');
      if (!r.ok) return editUI(ctx, T.adminAddFail('Channel already added.'), K.adminBack());
      await S.logActivity('channel', `Channel added · @${parsed.username}`);
      return editUI(ctx, T.adminAddOk(parsed.username, title), K.adminAddOk());
    }
    case 'admin_broadcast': {
      if (!isAdmin) { await delUserMsg(ctx); return showMain(ctx); }
      const sourceChatId = ctx.chat.id;
      const sourceMsgId = ctx.message.message_id;
      const s2 = sess(ctx.from.id);
      const chatId = s2.chatId, msgId = s2.msgId;

      await editUI(ctx, T.adminBroadcastStart(), K.adminBack());
      await delUserMsg(ctx);
      setState(ctx.from.id, 'idle');

      (async () => {
        const ids = await S.listAllUserIds();
        let ok = 0, fail = 0;
        for (const uid of ids) {
          try { await bot.telegram.copyMessage(uid, sourceChatId, sourceMsgId); ok++; }
          catch (_) { fail++; }
        }
        try {
          await safeEdit(ctx, chatId, msgId, T.adminBroadcastResult(ok, fail), K.adminBroadcastResult());
          await S.logActivity('broadcast', `Broadcast sent to ${ok} users`);
        } catch (_) {}
      })();
      return;
    }
    case 'admin_grant': {
      await delUserMsg(ctx);
      const parts = text.split('|').map(x => x.trim());
      if (parts.length !== 2) return editUI(ctx, T.adminAddFail('Format: user_id | amount'), K.adminBack());
      const [uid, amt] = parts;
      const n = parseInt(amt, 10);
      if (!/^\d+$/.test(uid) || !Number.isFinite(n) || n <= 0) return editUI(ctx, T.adminAddFail('Invalid ID or amount.'), K.adminBack());
      const target = await S.getUser(uid);
      if (!target) return editUI(ctx, T.adminAddFail('User not found.'), K.adminBack());
      const total = await S.addStars(uid, n);
      setState(ctx.from.id, 'idle');
      await S.logActivity('grant', `Granted ${n} ⭐ to ${uid}`);
      return editUI(ctx, T.adminGrantOk(uid, n, total), K.adminGrantOk());
    }
    case 'withdraw_request': {
      await delUserMsg(ctx);
      const parts = text.split('|').map(x => x.trim());
      if (parts.length < 3) return editUI(ctx, T.withdrawFail('Format: amount | method | details'), K.withdrawCancel());
      const [amt, method, ...rest] = parts;
      const details = rest.join(' | ');
      const n = parseInt(amt, 10);
      if (!Number.isFinite(n) || n < cfg().withdrawMin) return editUI(ctx, T.withdrawFail(`Minimum is ${cfg().withdrawMin} stars.`), K.withdrawCancel());
      const u = await S.getUser(ctx.from.id);
      if ((u.stars || 0) < n) return editUI(ctx, T.withdrawFail('Insufficient balance.'), K.withdrawCancel());

      const w = await S.createWithdrawal(ctx.from.id, n, method, details);
      setState(ctx.from.id, 'idle');
      await S.logActivity('withdraw', `Withdraw request #${w.id} · ${n} ⭐`);
      return editUI(ctx, T.withdrawOk(w), K.withdrawOk());
    }
    default: return;
  }
}

/* ─────────  REGISTER  ───────── */
function register(bot) {
  bot.start(async (ctx) => {
    try {
      await S.upsertUser(ctx.from);

      const payload = ctx.startPayload || '';
      if (payload.startsWith('ref_')) {
        const refId = payload.slice(4);
        const r = await S.applyReferral(ctx.from.id, refId);
        if (r.ok) {
          await S.logActivity('referral', `New referral · user ${ctx.from.id}`);
          try { await bot.telegram.sendMessage(refId, `⭐ You earned +${r.reward} stars from a new referral!`); } catch (_) {}
        }
      }

      const chk = await checkChannels(bot, ctx.from.id);
      const s = sess(ctx.from.id);
      if (!chk.ok) {
        const m = await ctx.reply(T.forceJoin(chk.missing), OPTS(K.forceJoin(chk.missing)));
        s.chatId = m.chat.id; s.msgId = m.message_id; s.state = 'idle'; return;
      }
      const isAdmin = cfg().admins.includes(ctx.from.id);
      const m = await ctx.reply(T.welcome(), OPTS(K.main(isAdmin)));
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
  bot.on(['photo', 'video', 'document', 'audio', 'voice', 'sticker'], async (ctx) => {
    const s = sess(ctx.from.id);
    if (s.state === 'admin_broadcast') return handleText(ctx, bot);
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const isAdmin = cfg().admins.includes(ctx.from.id);
    try {
      await answer(ctx);

      if (data === CB.MAIN) return showMain(ctx);
      if (data === CB.VERIFY) {
        const chk = await checkChannels(bot, ctx.from.id);
        // allow through if any missing are unverifiable
        const hardMissing = chk.missing.filter(c => !c.unverifiable);
        if (hardMissing.length) return editUI(ctx, T.forceJoinFail(hardMissing), K.forceJoinFail(hardMissing));
        return showMain(ctx);
      }

      if (data === CB.PROFILE) return renderProfile(ctx);
      if (data === CB.REFER) return renderRefer(ctx);
      if (data === CB.REF_COPY) return answer(ctx, 'Link copied!');
      if (data === CB.STARS) return renderStars(ctx);
      if (data === CB.PREMIUM) return renderPremium(ctx);
      if (data === CB.WITHDRAW) return renderWithdraw(ctx);
      if (data === CB.WITHDRAW_REQUEST) { setState(ctx.from.id, 'withdraw_request'); return editUI(ctx, T.withdrawAsk(), K.withdrawCancel()); }
      if (data === CB.WITHDRAW + ':list') return renderWithdrawList(ctx);
      if (data === CB.TOS) { setState(ctx.from.id, 'idle'); return editUI(ctx, T.terms(), K.back()); }
      if (data === CB.SUP) { setState(ctx.from.id, 'idle'); return editUI(ctx, T.support(), K.support()); }
      if (data === CB.SUP + ':c') return;

      /* STAR PACK */
      if (data.startsWith('spk:')) {
        const id = Number(data.slice(4));
        const pack = S.STAR_PACKS.find(p => p.id === id);
        if (!pack) return renderStars(ctx);
        return editUI(ctx, T.starConfirm(pack), K.starConfirm(pack));
      }
      if (data.startsWith('spc:')) {
        const id = Number(data.slice(4));
        const pack = S.STAR_PACKS.find(p => p.id === id);
        if (!pack) return renderStars(ctx);
        const req = await S.createStarRequest(ctx.from.id, id);
        setState(ctx.from.id, 'idle');
        await S.logActivity('star-req', `User ${ctx.from.id} requested ${pack.price} ⭐ pack`);
        // notify admins
        for (const adm of cfg().admins) {
          try { await bot.telegram.sendMessage(adm, `⭐ New star request #${req.id}\nUser · <code>${ctx.from.id}</code>\nPack · ${req.price} ⭐ → ${req.get} ⭐`, { parse_mode: 'HTML' }); } catch (_) {}
        }
        return editUI(ctx, T.starSent(req), K.starSent());
      }

      /* PREMIUM PLAN */
      if (data.startsWith('pmp:')) {
        const planId = data.slice(4);
        const plan = S.PREMIUM_PLANS.find(p => p.id === planId);
        if (!plan) return renderPremium(ctx);
        const s = sess(ctx.from.id);
        await playLoading(ctx, s.chatId, s.msgId,
          // fallback text
          '', [],
          async () => {
            const r = await S.buyPremiumPlan(ctx.from.id, planId);
            if (!r.ok) return { text: T.premiumFail(r.reason === 'insufficient' ? 'Not enough stars.' : 'Purchase failed.'), kb: K.back() };
            await S.logActivity('premium', `User ${ctx.from.id} bought ${plan.label}`);
            return { text: T.premiumOk(plan, r.premiumUntil, r.stars), kb: K.premiumOk() };
          }
        );
        return;
      }

      /* ADMIN */
      if (!isAdmin) return;
      if (data === CB.ADMIN) return renderAdmin(ctx);
      if (data === CB.ADM_ADD) { setState(ctx.from.id, 'admin_add_channel'); return editUI(ctx, T.adminAddChannel(), K.adminBack()); }
      if (data === CB.ADM_LIST) return renderChannelList(ctx);
      if (data === CB.ADM_REMOVE) return renderRemovePick(ctx);
      if (data === CB.ADM_BC) { setState(ctx.from.id, 'admin_broadcast'); return editUI(ctx, T.adminBroadcast(), K.adminBack()); }
      if (data === CB.ADM_GRANT) { setState(ctx.from.id, 'admin_grant'); return editUI(ctx, T.adminGrant(), K.adminBack()); }
      if (data === CB.ADM_WD) return renderWDPick(ctx);
      if (data === CB.ADM_SR) return renderSRPick(ctx);

      if (data.startsWith('arx:')) {
        const uname = data.slice(4);
        const c = (await S.listChannels()).find(x => x.username === uname);
        if (!c) return renderRemovePick(ctx);
        return editUI(ctx, T.adminRemoveConfirm(c), K.adminRemoveConfirm(uname));
      }
      if (data.startsWith('aro:')) { await S.removeChannel(data.slice(4)); return editUI(ctx, T.adminRemoveOk(), K.adminRemoveOk()); }

      if (data.startsWith('awx:')) {
        const w = await S.getWithdrawal(data.slice(4));
        if (!w) return renderWDPick(ctx);
        return editUI(ctx, T.adminWDDetail(w), K.adminWDDetail(w.id));
      }
      if (data.startsWith('awo:')) { const id = data.slice(4); await S.updateWithdrawal(id, 'approved'); return editUI(ctx, T.adminWDOk(id), K.adminWDDone()); }
      if (data.startsWith('awr:')) { const id = data.slice(4); await S.updateWithdrawal(id, 'rejected'); return editUI(ctx, T.adminWDRj(id), K.adminWDDone()); }

      if (data.startsWith('asx:')) {
        const r = await S.getStarRequest(data.slice(4));
        if (!r) return renderSRPick(ctx);
        return editUI(ctx, T.adminSRDetail(r), K.adminSRDetail(r.id));
      }
      if (data.startsWith('aso:')) {
        const id = data.slice(4);
        const r = await S.getStarRequest(id);
        if (!r) return renderSRPick(ctx);
        await S.updateStarRequest(id, 'approved');
        const newBal = await S.addStars(r.userId, r.get);
        try { await bot.telegram.sendMessage(r.userId, `✅ Your star top-up was approved!\n\nReceived · ${r.get} ⭐\nNew balance · ${newBal} ⭐`, { parse_mode: 'HTML' }); } catch (_) {}
        return editUI(ctx, T.adminSROk(id, r.get), K.adminSRDone());
      }
      if (data.startsWith('asr:')) {
        const id = data.slice(4);
        const r = await S.getStarRequest(id);
        if (!r) return renderSRPick(ctx);
        await S.updateStarRequest(id, 'rejected');
        try { await bot.telegram.sendMessage(r.userId, `❌ Your star top-up request #${id} was rejected.`, { parse_mode: 'HTML' }); } catch (_) {}
        return editUI(ctx, T.adminSRRj(id), K.adminSRDone());
      }
    } catch (e) {
      console.error('[callback]', e?.description || e);
      try { await ctx.answerCbQuery('Error'); } catch (_) {}
    }
  });
}

module.exports = { register };
