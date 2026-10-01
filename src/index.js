require('dotenv').config();
const path = require('path');
const http = require('http');
const { Telegraf } = require('telegraf');
const services = require('./services');

const config = {
  token: process.env.BOT_TOKEN || '',
  admins: (process.env.ADMIN_IDS || '').split(',').map(s => Number(s.trim())).filter(Boolean),
  support: (process.env.SUPPORT_USERNAME || '').replace(/^@/, ''),
  pinMin: parseInt(process.env.PIN_MIN_LENGTH || '4', 10),
  pinMax: parseInt(process.env.PIN_MAX_LENGTH || '6', 10),
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  useCustomEmojis: process.env.USE_CUSTOM_EMOJIS !== 'false',
  dataDir: (() => {
    const raw = (process.env.DATA_DIR || '').trim();
    if (raw && raw !== '/data' && !raw.startsWith('/data/')) return raw;
    return path.join(process.cwd(), 'data');
  })(),
  buttonStyles: process.env.BUTTON_STYLES !== 'false',
  emojis: {
    STAR: process.env.STAR_EMOJI_ID || '', SPARKLE: process.env.SPARKLE_EMOJI_ID || '',
    MAIL: process.env.MAIL_EMOJI_ID || '', SUCCESS: process.env.SUCCESS_EMOJI_ID || '',
    WARNING: process.env.WARNING_EMOJI_ID || '', BACK: process.env.BACK_EMOJI_ID || '',
    SUPPORT: process.env.SUPPORT_EMOJI_ID || '', PLUS: process.env.PLUS_EMOJI_ID || '',
    TRASH: process.env.TRASH_EMOJI_ID || '', USER: process.env.USER_EMOJI_ID || '',
    DOC: process.env.DOC_EMOJI_ID || '', KEY: process.env.KEY_EMOJI_ID || '',
    REFRESH: process.env.REFRESH_EMOJI_ID || '', LOCK: process.env.LOCK_EMOJI_ID || '',
    UNLOCK: process.env.UNLOCK_EMOJI_ID || '', INFO: process.env.INFO_EMOJI_ID || '',
    ERROR: process.env.ERROR_EMOJI_ID || '', GIFT: process.env.GIFT_EMOJI_ID || '',
    CROWN: process.env.CROWN_EMOJI_ID || '', FOLDER: process.env.FOLDER_EMOJI_ID || '',
    HEART: process.env.HEART_EMOJI_ID || '', FIRE: process.env.FIRE_EMOJI_ID || '',
    ROCKET: process.env.ROCKET_EMOJI_ID || '', DIAMOND: process.env.DIAMOND_EMOJI_ID || '',
    CHECK: process.env.CHECK_EMOJI_ID || '', SECURITY: process.env.SECURITY_EMOJI_ID || '',
  },
};

if (!config.token) { console.error('[FATAL] BOT_TOKEN missing'); process.exit(1); }
global.VEYRO = config;
const { register } = require('./handlers');

/* ─────────  WEBSITE  ───────── */
function page(userCount, channelCount) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VEYRO · Broadcast</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
body{min-height:100vh;background:radial-gradient(circle at 20% 0%,#1a1f3a 0%,#0a0e1f 50%,#05070f 100%);color:#e6e8f0;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden}
.bg{position:fixed;inset:0;background:radial-gradient(circle at 80% 80%,rgba(88,101,242,.15) 0%,transparent 40%),radial-gradient(circle at 10% 90%,rgba(255,71,87,.12) 0%,transparent 40%);pointer-events:none}
.wrap{position:relative;max-width:520px;width:100%;background:rgba(22,26,44,.72);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:40px 32px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.logo{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.dot{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 12px #22c55e;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
h1{font-size:34px;font-weight:800;letter-spacing:-1px;background:linear-gradient(135deg,#fff 0%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{color:#8b92a8;font-size:14px;margin-top:4px;font-weight:500;letter-spacing:.4px}
.tag{display:inline-flex;align-items:center;gap:8px;margin-top:22px;padding:6px 14px;border-radius:100px;background:rgba(88,101,242,.15);border:1px solid rgba(88,101,242,.35);color:#a5b4fc;font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:28px}
.stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:18px 16px;transition:.3s}
.stat:hover{background:rgba(255,255,255,.06);transform:translateY(-2px)}
.stat .n{font-size:26px;font-weight:800;color:#fff}
.stat .l{font-size:11px;color:#8b92a8;margin-top:4px;letter-spacing:1px;text-transform:uppercase;font-weight:600}
.btn{display:block;text-align:center;margin-top:28px;padding:16px;border-radius:14px;background:linear-gradient(135deg,#5865f2,#7c8cfb);color:#fff;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 10px 30px rgba(88,101,242,.35);transition:.3s}
.btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(88,101,242,.5)}
.foot{text-align:center;color:#4a5168;font-size:11px;margin-top:22px;letter-spacing:1px;text-transform:uppercase;font-weight:600}
</style></head><body>
<div class="bg"></div>
<div class="wrap">
<div class="logo"><div class="dot"></div><h1>VEYRO</h1></div>
<div class="sub">Broadcast System · Live</div>
<div class="tag">● Online</div>
<div class="grid">
<div class="stat"><div class="n">${userCount}</div><div class="l">Users</div></div>
<div class="stat"><div class="n">${channelCount}</div><div class="l">Channels</div></div>
</div>
<a class="btn" href="https://t.me/${(process.env.BOT_USERNAME || '').replace(/^@/,'') || ''}">Open on Telegram</a>
<div class="foot">Powered by VEYRO</div>
</div></body></html>`;
}

async function main() {
  await services.init(config.dataDir);

  const port = process.env.PORT || 10000;
  http.createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
    const [u, c] = await Promise.all([services.countUsers(), services.countChannels()]);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(u, c));
  }).listen(port, () => console.log(`[HTTP] :${port}`));

  const bot = new Telegraf(config.token);
  bot.catch((err) => console.error('[BOT ERR]', err?.description || err));
  register(bot);

  const stop = (sig) => { try { bot.stop(sig); } catch (_) {} setTimeout(() => process.exit(0), 400); };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  await bot.launch();
  console.log(`✔ VEYRO live · ${config.dataDir}`);
}

main().catch((err) => { console.error('[FATAL]', err); process.exit(1); });
