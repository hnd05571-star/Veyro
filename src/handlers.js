const { CB, T, K, kb } = require('./ui');
const S = require('./services');
const cfg = global.VEYRO;

/* ─────────  SESSIONS (in-memory, transient UI state only)  ───────── */
const sessions = new Map();
const sess = (id) => {
  if (!sessions.has(id)) {
    sessions.set(id, { state: 'idle', data: {}, chatId: null, msgId: null });
  }
  return sessions.get(id);
};
const setState = (id, state, data = {}) => {
  const s = sess(id);
  s.state = state;
  s.data = data;
  return s;
};

/* ─────────  UI HELPERS  ───────── */
async function editUI(ctx, text, keyboard) {
  const s = sess(ctx.from.id);
  if (!s.chatId || !s.msgId) {
    const m = await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: kb(keyboard),
      link_preview_options: { is_disabled: true },
    });
    s.chatId = m.chat.id;
    s.msgId = m.message_id;
    return;
  }
  try {
    await ctx.telegram.editMessageText(s.chatId, s.msgId, undefined, text, {
      parse_mode: 'HTML',
      reply_markup: kb(keyboard),
      link_preview_options: { is_disabled: true },
    });
  } catch (e) {
    const desc = e?.description || '';
    if (!/message is not modified/i.test(desc)) {
      console.error('[editUI]', desc || e);
    }
  }
}

async function answer(ctx) {
  try { await ctx.answerCbQuery(); } catch (_) {}
}

async function delUserMsg(ctx) {
  try { await ctx.deleteMessage(); } catch (_) {}
}

/* ─────────  GMAIL RENDERERS  ───────── */
async function renderGmailList(ctx) {
  const emails = await S.listGmails(ctx.from.id);
  if (!emails.length) return editUI(ctx, T.gmailList([]), K.gmailEmpty());
  return editUI(ctx, T.gmailList(emails), K.gmailList(emails));
}

async function renderSecurity(ctx) {
  const u = await S.getUser(ctx.from.id);
  setState(ctx.from.id, 'idle');
  return editUI(ctx, T.security(u), K.security(u));
}

/* ─────────  PIN GATE  ───────── */
async function withPin(ctx, next) {
  const u = await S.getUser(ctx.from.id);
  if (!u?.pinEnabled) return next(ctx);
  setState(ctx.from.id, 'pin_verify', { next });
  return editUI(ctx, T.pinProtected(), K.protected());
}

/* ─────────  TEXT INPUT HANDLER  ───────── */
async function handleText(ctx) {
  const s = sess(ctx.from.id);
  const text = (ctx.message.text || '').trim();

  switch (s.state) {
    case 'gmail_add': {
      await delUserMsg(ctx);
      if (!S.validGmail(text)) return editUI(ctx, T.gmailInvalid(), K.cancel());
      const r = await S.addGmail(ctx.from.id, text);
      if (!r.ok) return editUI(ctx, T.gmailDup(), K.cancel());
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.gmailAdded(r.email), K.gmailAdded());
    }

    case 'pin_set': {
      await delUserMsg(ctx);
      if (!S.validPin(text, cfg.pinMin, cfg.pinMax)) {
        return editUI(ctx, T.pinBadFormat(), K.cancel());
      }
      await S.setPin(ctx.from.id, text);
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.pinEnabled(), K.pinResult());
    }

    case 'pin_change_current': {
      await delUserMsg(ctx);
      const r = await S.verifyPin(ctx.from.id, text);
      if (!r.ok) {
        setState(ctx.from.id, 'idle');
        return editUI(
          ctx,
          r.reason === 'locked' ? T.pinLocked(r.remaining) : T.pinWrong(),
          r.reason === 'locked' ? K.back() : K.pinWrong()
        );
      }
      setState(ctx.from.id, 'pin_change_new');
      return editUI(ctx, T.pinChangeNew(), K.cancel());
    }

    case 'pin_change_new': {
      await delUserMsg(ctx);
      if (!S.validPin(text, cfg.pinMin, cfg.pinMax)) {
        return editUI(ctx, T.pinBadFormat(), K.cancel());
      }
      await S.setPin(ctx.from.id, text);
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.pinChanged(), K.pinResult());
    }

    case 'pin_disable_current': {
      await delUserMsg(ctx);
      const r = await S.verifyPin(ctx.from.id, text);
      if (!r.ok) {
        setState(ctx.from.id, 'idle');
        return editUI(
          ctx,
          r.reason === 'locked' ? T.pinLocked(r.remaining) : T.pinWrong(),
          r.reason === 'locked' ? K.back() : K.pinWrong()
        );
      }
      setState(ctx.from.id, 'idle');
      return editUI(ctx, T.pinDisableConfirm(), K.pinDisableConfirm());
    }

    case 'pin_verify': {
      await delUserMsg(ctx);
      const r = await S.verifyPin(ctx.from.id, text);
      if (!r.ok) {
        setState(ctx.from.id, 'idle');
        return editUI(
          ctx,
          r.reason === 'locked' ? T.pinLocked(r.remaining) : T.pinWrong(),
          r.reason === 'locked' ? K.back() : K.pinWrong()
        );
      }
      const next = s.data?.next || renderGmailList;
      setState(ctx.from.id, 'idle');
      return next(ctx);
    }

    default:
      return;
  }
}

/* ─────────  REGISTER ALL HANDLERS  ───────── */
function register(bot) {
  /* /start */
  bot.start(async (ctx) => {
    try {
      await S.upsertUser(ctx.from);
      const m = await ctx.reply(T.welcome(), {
        parse_mode: 'HTML',
        reply_markup: kb(K.main()),
        link_preview_options: { is_disabled: true },
      });
      const s = sess(ctx.from.id);
      s.state = 'idle';
      s.data = {};
      s.chatId = m.chat.id;
      s.msgId = m.message_id;
    } catch (e) {
      console.error('[start]', e);
    }
  });

  /* Text messages */
  bot.on('text', async (ctx) => {
    const s = sess(ctx.from.id);
    if (s.state && s.state !== 'idle') return handleText(ctx);

    if (ctx.message.text?.startsWith('/') && ctx.message.text !== '/start') {
      try { await ctx.deleteMessage(); } catch (_) {}
    }
  });

  /* Callback queries */
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    try {
      await answer(ctx);

      if (data === CB.MAIN) {
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.welcome(), K.main());
      }

      if (data === CB.ADD) {
        setState(ctx.from.id, 'gmail_add');
        return editUI(ctx, T.gmailAdd(), K.cancel());
      }

      if (data === CB.LIST) {
        return withPin(ctx, renderGmailList);
      }

      if (data.startsWith('gv:')) {
        const i = Number(data.slice(3));
        const em = await S.getGmail(ctx.from.id, i);
        if (!em) return renderGmailList(ctx);
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.gmailDetails(em), K.gmailDetails(i));
      }

      if (data.startsWith('gd:')) {
        const i = Number(data.slice(3));
        const em = await S.getGmail(ctx.from.id, i);
        if (!em) return renderGmailList(ctx);
        return editUI(ctx, T.gmailDel(em), K.gmailDelConfirm(i));
      }

      if (data.startsWith('gdx:')) {
        const i = Number(data.slice(4));
        const em = await S.getGmail(ctx.from.id, i);
        if (!em) return renderGmailList(ctx);
        await S.deleteGmail(ctx.from.id, em);
        return editUI(ctx, T.gmailDelOk(), K.gmailDeleted());
      }

      if (data === CB.SEC) return renderSecurity(ctx);

      if (data === CB.pinSet) {
        setState(ctx.from.id, 'pin_set');
        return editUI(ctx, T.pinSetPrompt(), K.cancel());
      }

      if (data === CB.pinChange) {
        setState(ctx.from.id, 'pin_change_current');
        return editUI(ctx, T.pinChangeCurrent(), K.cancel());
      }

      if (data === CB.pinDisable) {
        setState(ctx.from.id, 'pin_disable_current');
        return editUI(ctx, T.pinDisableCurrent(), K.cancel());
      }

      if (data === CB.pinDisableOk) {
        await S.disablePin(ctx.from.id);
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.pinDisabled(), K.pinResult());
      }

      if (data === CB.pinRetry) {
        setState(ctx.from.id, 'pin_verify', { next: renderGmailList });
        return editUI(ctx, T.pinProtected(), K.protected());
      }

      if (data === CB.ACC) {
        const u = await S.getUser(ctx.from.id);
        const n = await S.countGmails(ctx.from.id);
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.account(u, n), K.back());
      }

      if (data === CB.TOS) {
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.terms(), K.back());
      }

      if (data === CB.SUP) {
        setState(ctx.from.id, 'idle');
        return editUI(ctx, T.support(), K.support());
      }

      if (data === CB.SUP + ':c') return;
    } catch (e) {
      console.error('[callback]', e);
      try { await ctx.answerCbQuery('Something went wrong.'); } catch (_) {}
    }
  });
}

module.exports = { register };
