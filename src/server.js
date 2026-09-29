'use strict';

/**
 * HTTP server for POST-IT.
 *
 * - GET  /          → health check / status JSON (what deploy platforms ping)
 * - GET  /healthz   → same, alias
 * - POST /webhook   → Telegram updates (webhook mode)
 */

const express = require('express');

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

function createApp(bot) {
  const app = express();
  app.disable('x-powered-by');

  // Telegraf's express webhook adapter expects the parsed JSON body.
  app.use(express.json({ limit: '256kb' }));

  const startedAt = new Date().toISOString();

  function health(req, res) {
    res.json({
      ok: true,
      service: 'POST-IT',
      mode: process.env.WEBHOOK_URL ? 'webhook' : 'polling',
      startedAt,
      time: new Date().toISOString(),
    });
  }

  app.get('/', health);
  app.get('/healthz', health);

  // Telegram updates. When WEBHOOK_SECRET is set, reject anything that
  // doesn't carry the matching secret header Telegram adds automatically.
  // We acknowledge instantly and process asynchronously so slow handlers
  // never make Telegram retry.
  app.post(
    '/webhook',
    (req, res, next) => {
      const expected = process.env.WEBHOOK_SECRET;
      if (expected && req.get(SECRET_HEADER) !== expected) {
        return res.sendStatus(401);
      }
      return next();
    },
    (req, res) => {
      res.status(200).end();
      Promise.resolve(bot.handleUpdate(req.body)).catch((err) => {
        console.error('[server] Failed to handle Telegram update:', err.message);
      });
    },
  );

  return app;
}

module.exports = { createApp };
