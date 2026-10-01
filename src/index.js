require('dotenv').config();
const path = require('path');
const http = require('http');
const { Telegraf } = require('telegraf');
const services = require('./services');

const config = {
  token: process.env.BOT_TOKEN || '',
  botUsername: (process.env.BOT_USERNAME || '').replace(/^@/, ''),
  admins: (process.env.ADMIN_IDS || '').split(',').map(s => Number(s.trim())).filter(Boolean),
  support: (process.env.SUPPORT_USERNAME || '').replace(/^@/, ''),
  pinMin: parseInt(process.env.PIN_MIN_LENGTH || '4', 10),
  pinMax: parseInt(process.env.PIN_MAX_LENGTH || '6', 10),
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  useCustomEmojis: process.env.USE_CUSTOM_EMOJIS !== 'false',
  emojiPool: (process.env.EMOJI_POOL || '').split(',').map(s => s.trim()).filter(Boolean),
  upiId: process.env.UPI_ID || 'Harshsinghs@fam',
  upiName: process.env.UPI_NAME || 'VEYRO',
  refReward: services.REFERRAL_REWARD,
  withdrawMin: services.WITHDRAW_MIN,
  dataDir: (() => {
    const raw = (process.env.DATA_DIR || '').trim();
    if (raw && raw !== '/data' && !raw.startsWith('/data/')) return raw;
    return path.join(process.cwd(), 'data');
  })(),
  buttonStyles: process.env.BUTTON_STYLES !== 'false',
  webhookUrl: (process.env.WEBHOOK_URL || '').trim().replace(/\/$/, ''),
  webhookPath: (process.env.WEBHOOK_PATH || '/telegraf').trim(),
};

if (!config.token) { console.error('[FATAL] BOT_TOKEN missing'); process.exit(1); }
global.VEYRO = config;
const { register } = require('./handlers');

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function timeAgo(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return s + 's'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; }

function page(stats) {
  const { userCount, channelCount, starTotal, refTotal, premiumTotal, pendingWD, pendingSR, pendingPay, top, activity, botUsername, starReqs, withdrawals, payments } = stats;

  const leaderRows = top.length ? top.map((u, i) => `
    <div class="row">
      <div class="rank">#${i + 1}</div>
      <div class="who">
        <div class="name">${esc(u.firstName || 'User')}</div>
        <div class="handle">${u.username ? '@' + esc(u.username) : 'id ' + u.id}</div>
      </div>
      <div class="score">${u.referrals} refs · ${u.stars} ⭐</div>
    </div>`).join('') : '<div class="empty">No referrers yet.</div>';

  const activityRows = activity.length ? activity.map(a => `<div class="feed"><span class="dotp"></span>${esc(a.text)}<span class="t">${timeAgo(a.at)}</span></div>`).join('') : '<div class="empty">No recent activity.</div>';

  const payRows = payments.length ? payments.slice(0, 15).map(p => `
    <div class="row">
      <div class="rank">#${p.id}</div>
      <div class="who">
        <div class="name">${esc(p.type)} · ₹${p.amountInr}</div>
        <div class="handle">user ${p.userId} · ${esc(p.label)}</div>
      </div>
      <div class="score">pending</div>
    </div>`).join('') : '<div class="empty">No pending payments.</div>';

  const wdRows = withdrawals.length ? withdrawals.slice(0, 10).map(w => `
    <div class="row">
      <div class="rank">#${w.id}</div>
      <div class="who">
        <div class="name">Withdraw · ${w.amount} ⭐</div>
        <div class="handle">user ${w.userId} · ${esc(w.method)}</div>
      </div>
      <div class="score">pending</div>
    </div>`).join('') : '<div class="empty">No pending withdrawals.</div>';

  const srRows = starReqs.length ? starReqs.slice(0, 10).map(r => `
    <div class="row">
      <div class="rank">#${r.id}</div>
      <div class="who">
        <div class="name">Star pack · ${r.price} ⭐ → ${r.get} ⭐</div>
        <div class="handle">user ${r.userId}</div>
      </div>
      <div class="score">pending</div>
    </div>`).join('') : '<div class="empty">No pending star requests.</div>';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VEYRO · Live Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
body{min-height:100vh;background:#05070f;color:#e6e8f0;padding:24px;overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 20% 0%,rgba(88,101,242,.18),transparent 50%),radial-gradient(circle at 90% 100%,rgba(255,71,87,.12),transparent 45%);pointer-events:none;z-index:0}
.wrap{position:relative;z-index:1;max-width:820px;margin:0 auto}
.head{display:flex;align-items:center;gap:14px;margin-bottom:8px}
.dot{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 14px #22c55e;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
h1{font-size:38px;font-weight:900;letter-spacing:-1.4px;background:linear-gradient(135deg,#fff,#a5b4fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{color:#8b92a8;font-size:14px;font-weight:500;letter-spacing:.4px;margin-bottom:26px}
.tag{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:100px;background:rgba(88,101,242,.14);border:1px solid rgba(88,101,242,.35);color:#a5b4fc;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:26px}
.stat{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;transition:.25s}
.stat:hover{background:rgba(255,255,255,.065);transform:translateY(-2px)}
.stat .n{font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px}
.stat .l{font-size:10px;color:#8b92a8;margin-top:4px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700}
.card{background:rgba(22,26,44,.7);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;margin-bottom:20px}
.card h2{font-size:15px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#8b92a8;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card h2:before{content:"";width:4px;height:14px;background:linear-gradient(180deg,#5865f2,#7c8cfb);border-radius:2px}
.row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.row:last-child{border-bottom:0}
.rank{font-size:13px;font-weight:800;color:#a5b4fc;min-width:48px}
.who{flex:1;min-width:0}
.name{font-size:14px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.handle{font-size:11px;color:#667;margin-top:2px}
.score{font-size:12px;color:#a5b4fc;font-weight:600;white-space:nowrap}
.feed{display:flex;align-items:center;gap:10px;padding:9px 0;font-size:13px;color:#c5cade;border-bottom:1px solid rgba(255,255,255,.03)}
.feed:last-child{border-bottom:0}
.dotp{width:6px;height:6px;border-radius:50%;background:#5865f2;box-shadow:0 0 8px #5865f2;flex-shrink:0}
.feed .t{margin-left:auto;color:#556;font-size:11px}
.empty{color:#556;font-size:13px;padding:14px 0;text-align:center}
.btn{display:block;text-align:center;margin-top:22px;padding:16px;border-radius:14px;background:linear-gradient(135deg,#5865f2,#7c8cfb);color:#fff;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 10px 30px rgba(88,101,242,.35);transition:.25s}
.btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(88,101,242,.5)}
.foot{text-align:center;color:#3a4058;font-size:11px;margin-top:22px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700}
</style></head><body>
<div class="wrap">
  <div class="head"><div class="dot"></div><h1>VEYRO</h1></div>
  <div class="sub">Broadcast · Live Dashboard</div>
  <div class="tag">● Online</div>

  <div class="grid">
    <div class="stat"><div class="n">${userCount}</div><div class="l">Users</div></div>
    <div class="stat"><div class="n">${channelCount}</div><div class="l">Channels</div></div>
    <div class="stat"><div class="n">${starTotal.toLocaleString()}</div><div class="l">Stars</div></div>
    <div class="stat"><div class="n">${refTotal}</div><div class="l">Referrals</div></div>
    <div class="stat"><div class="n">${premiumTotal}</div><div class="l">Premium</div></div>
    <div class="stat"><div class="n">${pendingPay}</div><div class="l">Payments</div></div>
    <div class="stat"><div class="n">${pendingWD}</div><div class="l">Withdrawals</div></div>
    <div class="stat"><div class="n">${pendingSR}</div><div class="l">Star Reqs</div></div>
  </div>

  <div class="card"><h2>Pending Payments</h2>${payRows}</div>
  <div class="card"><h2>Pending Star Requests</h2>${srRows}</div>
  <div class="card"><h2>Pending Withdrawals</h2>${wdRows}</div>
  <div class="card"><h2>Top Referrers</h2>${leaderRows}</div>
  <div class="card"><h2>Recent Activity</h2>${activityRows}</div>

  <a class="btn" href="https://t.me/${botUsername}">Open on Telegram</a>
  <div class="foot">Powered by VEYRO</div>
</div></body></html>`;
}

async function main() {
  await services.init(config.dataDir);

  const port = process.env.PORT || 10000;

  const bot = new Telegraf(config.token);
  bot.catch((err) => console.error('[BOT ERR]', err?.description || err));
  register(bot);

  /* ─────────  HTTP SERVER (webhook + dashboard)  ───────── */
  const server = http.createServer(async (req, res) => {
    // Telegram webhook endpoint
    if (config.webhookUrl && req.url === config.webhookPath && req.method === 'POST') {
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        await bot.handleUpdate(body);
        res.writeHead(200); res.end('ok');
      } catch (e) {
        console.error('[WEBHOOK]', e?.message || e);
        res.writeHead(500); res.end('error');
      }
      return;
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200); return res.end('ok');
    }

    // Dashboard
    try {
      const [userCount, channelCount, starTotal, refTotal, premiumTotal, pendingWD, pendingSR, pendingPay, top, activity, starReqs, withdrawals, payments] = await Promise.all([
        services.countUsers(), services.countChannels(), services.totalStarsDistributed(),
        services.totalReferrals(), services.premiumCount(), services.countPendingWithdrawals(),
        services.countPendingStarRequests(), services.countPendingPayments(),
        services.topReferrers(10), services.recentActivity(15),
        services.listPendingStarRequests(), services.listPendingWithdrawals(),
        services.listPendingPayments(),
      ]);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page({ userCount, channelCount, starTotal, refTotal, premiumTotal, pendingWD, pendingSR, pendingPay, top, activity, starReqs, withdrawals, payments, botUsername: config.botUsername }));
    } catch (e) {
      console.error('[WEB]', e);
      res.writeHead(500); res.end('error');
    }
  });

  server.listen(port, () => console.log(`[HTTP] :${port}`));

  /* ─────────  WEBHOOK OR POLLING  ───────── */
  if (config.webhookUrl) {
    const fullUrl = `${config.webhookUrl}${config.webhookPath}`;
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await new Promise(r => setTimeout(r, 500));
      await bot.telegram.setWebhook(fullUrl, { drop_pending_updates: true, allowed_updates: ['message', 'callback_query'] });
      const info = await bot.telegram.getWebhookInfo();
      console.log(`✔ Webhook → ${info.url}`);
      console.log(`✔ VEYRO live (webhook) · ${config.dataDir}`);
    } catch (e) {
      console.error('[WEBHOOK SETUP]', e?.description || e);
      process.exit(1);
    }
    const stop = () => { server.close(); setTimeout(() => process.exit(0), 300); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } else {
    console.log('[MODE] Long polling (WEBHOOK_URL not set)');
    const stop = (sig) => {
      try { bot.stop(sig); } catch (_) {}
      try { server.close(); } catch (_) {}
      setTimeout(() => process.exit(0), 400);
    };
    process.once('SIGINT', () => stop('SIGINT'));
    process.once('SIGTERM', () => stop('SIGTERM'));
    await bot.launch({ dropPendingUpdates: true });
    console.log(`✔ VEYRO live (polling) · ${config.dataDir}`);
  }
}

main().catch((err) => { console.error('[FATAL]', err); process.exit(1); });
