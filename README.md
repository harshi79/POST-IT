# POST-IT 📌

**A Telegram bot that keeps your notes like sticky notes.**

Send the bot any text and it sticks it on your board. Browse, search, and clean up your notes with simple commands — your ideas, links, and to-dos, always one message away.

## Features

- 💬 **Zero-friction capture** — every plain message you send becomes a post-it
- 🗒️ `/notes` — see your board, newest first
- 🔍 `/find <word>` — search your notes
- 🗑️ `/delete <number>` — remove a single note
- 🧹 `/clear confirm` — wipe the board (with confirmation)
- 🔒 **Private** — notes are per-chat, only visible in that chat
- 💾 **Persistent** — notes survive restarts and redeploys (JSON file storage, no database)

## Getting a bot token

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts
3. Copy the token (looks like `123456789:AAE...`)

## Running locally

```bash
npm install
cp .env.example .env      # then set BOT_TOKEN=... inside
npm start                 # or: npm run dev (auto-restart on changes)
```

Without `WEBHOOK_URL` the bot uses **long-polling** — nothing else to configure. Open your bot in Telegram and say hi.

## Environment variables

| Variable         | Required | Description                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------- |
| `BOT_TOKEN`      | ✅       | Token from [@BotFather](https://t.me/BotFather)                              |
| `PORT`           | –        | HTTP port (default `3000`; deploy platforms usually set this automatically) |
| `WEBHOOK_URL`    | –        | Public base URL of the deployment → enables webhook mode                     |
| `WEBHOOK_SECRET` | –        | Random string; Telegram must echo it in `X-Telegram-Bot-Api-Secret-Token`    |
| `DATA_DIR`       | –        | Directory for `notes.json` (default `./data`)                                |

## Deploying (webhook mode)

1. Set `BOT_TOKEN` and `WEBHOOK_URL=https://<your-app-url>` (plus a `WEBHOOK_SECRET`) in your host's dashboard
2. Start command: `npm start` — the server binds `0.0.0.0:$PORT` and exposes `GET /` (health check) and `POST /webhook`
3. On boot the bot registers `https://<your-app-url>/webhook` with Telegram automatically

## Project structure

```
src/
├── index.js   # entry point: env, wiring, polling/webhook mode, graceful shutdown
├── server.js  # Express app: health checks + POST /webhook
├── bot.js     # Telegraf bot: commands and handlers
└── notes.js   # JSON-file storage (atomic writes, per-chat notes)
data/          # runtime storage (gitignored)
```

## Tech

- [Node.js](https://nodejs.org) ≥ 18 · [Express](https://expressjs.com) · [Telegraf](https://telegraf.js.org)

## License

[MIT](LICENSE)
