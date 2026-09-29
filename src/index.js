'use strict';

/**
 * POST-IT entry point.
 *
 * Modes:
 *  - WEBHOOK_URL set  → Express receives Telegram updates at POST /webhook.
 *  - WEBHOOK_URL unset → long-polling against api.telegram.org (great for dev).
 *
 * The Express server always starts, so deploy platforms always get a port
 * and health check, in either mode.
 */

require('dotenv').config();

const store = require('./notes');
const { createBot } = require('./bot');
const { createApp } = require('./server');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setWebhookWithRetry(bot, url, secret) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await bot.telegram.setWebhook(url, secret ? { secret_token: secret } : undefined);
      console.log(`[POST-IT] Webhook registered: ${url}`);
      return;
    } catch (err) {
      console.error(`[POST-IT] setWebhook attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) await sleep(attempt * 2000);
    }
  }
  console.error('[POST-IT] Giving up on setWebhook — the HTTP server is still up. Restart to retry.');
}

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error(
      '[POST-IT] Missing BOT_TOKEN.\n' +
        '  1. Create a bot with @BotFather on Telegram and copy its token\n' +
        '  2. cp .env.example .env and set BOT_TOKEN=...\n' +
        '  3. Restart',
    );
    process.exit(1);
  }

  store.init();

  const bot = createBot(token);
  const app = createApp(bot);
  const port = Number(process.env.PORT || 3000);

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[POST-IT] HTTP server listening on 0.0.0.0:${port}`);
  });

  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    // Allow passing the base URL; we always point Telegram at /webhook.
    let url = webhookUrl.replace(/\/+$/, '');
    if (!url.endsWith('/webhook')) url += '/webhook';
    await setWebhookWithRetry(bot, url, process.env.WEBHOOK_SECRET);
  } else {
    console.log('[POST-IT] No WEBHOOK_URL set — starting long-polling.');
    bot
      .launch()
      .then(() => console.log('[POST-IT] Long-polling started. Send your bot a message!'))
      .catch((err) => {
        console.error(`[POST-IT] Polling failed: ${err.message}\n(Is BOT_TOKEN correct? Is the network up?)`);
      });
  }

  let stopping = false;
  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[POST-IT] ${signal} received, shutting down…`);
    try {
      bot.stop(signal);
    } catch {
      /* bot may not have been launched; ignore */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[POST-IT] Fatal startup error:', err);
  process.exit(1);
});
