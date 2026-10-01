require('dotenv').config();
const path = require('path');
const http = require('http');
const { Telegraf } = require('telegraf');
const services = require('./services');

/* ─────────  CONFIG  ───────── */
const config = {
  token: process.env.BOT_TOKEN || '',
  admins: (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Boolean),
  support: (process.env.SUPPORT_USERNAME || '').replace(/^@/, ''),
  pinMin: parseInt(process.env.PIN_MIN_LENGTH || '4', 10),
  pinMax: parseInt(process.env.PIN_MAX_LENGTH || '6', 10),
  dataDir: (() => {
    const raw = (process.env.DATA_DIR || '').trim();
    // Block /data root — not writable on Render free tier
    if (raw && raw !== '/data' && !raw.startsWith('/data/')) return raw;
    return path.join(process.cwd(), 'data');
  })(),
  buttonStyles: process.env.BUTTON_STYLES !== 'false',
  emojis: {
    STAR:     process.env.STAR_EMOJI_ID     || '',
    WELCOME:  process.env.WELCOME_EMOJI_ID  || '',
    MAIL:     process.env.MAIL_EMOJI_ID     || '',
    SUCCESS:  process.env.SUCCESS_EMOJI_ID  || '',
    WARNING:  process.env.WARNING_EMOJI_ID  || '',
    BACK:     process.env.BACK_EMOJI_ID     || '',
    SUPPORT:  process.env.SUPPORT_EMOJI_ID  || '',
    PLUS:     process.env.PLUS_EMOJI_ID     || '',
    TRASH:    process.env.TRASH_EMOJI_ID    || '',
    USER:     process.env.USER_EMOJI_ID     || '',
    DOC:      process.env.DOC_EMOJI_ID      || '',
    KEY:      process.env.KEY_EMOJI_ID      || '',
    REFRESH:  process.env.REFRESH_EMOJI_ID  || '',
    LOCK:     process.env.LOCK_EMOJI_ID     || '',
    UNLOCK:   process.env.UNLOCK_EMOJI_ID   || '',
    INFO:     process.env.INFO_EMOJI_ID     || '',
    ERROR:    process.env.ERROR_EMOJI_ID    || '',
    GIFT:     process.env.GIFT_EMOJI_ID     || '',
    CROWN:    process.env.CROWN_EMOJI_ID    || '',
    SPARKLE:  process.env.SPARKLE_EMOJI_ID  || '',
    FOLDER:   process.env.FOLDER_EMOJI_ID   || '',
    HEART:    process.env.HEART_EMOJI_ID    || '',
    FIRE:     process.env.FIRE_EMOJI_ID     || '',
    ROCKET:   process.env.ROCKET_EMOJI_ID   || '',
    DIAMOND:  process.env.DIAMOND_EMOJI_ID  || '',
    CHECK:    process.env.CHECK_EMOJI_ID    || '',
    SECURITY: process.env.SECURITY_EMOJI_ID || '',
  },
};

if (!config.token) {
  console.error('[FATAL] BOT_TOKEN missing in environment variables.');
  process.exit(1);
}

// ⚠️ MUST set global BEFORE requiring handlers (they read it lazily)
global.VEYRO = config;

const { register } = require('./handlers');

/* ─────────  MAIN  ───────── */
async function main() {
  await services.init(config.dataDir);

  // Tiny HTTP health server so Render Web Service detects an open port
  const port = process.env.PORT || 10000;
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('VEYRO is running');
    })
    .listen(port, () => console.log(`[HTTP] Health server on :${port}`));

  const bot = new Telegraf(config.token);

  bot.catch((err, ctx) => {
    console.error(`[BOT ERROR] updateType=${ctx?.updateType}`, err);
  });

  register(bot);

  const stop = (sig) => {
    try { bot.stop(sig); } catch (_) {}
    setTimeout(() => process.exit(0), 400);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  await bot.launch();
  console.log(`✔ VEYRO is live — data dir: ${config.dataDir}`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
