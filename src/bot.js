'use strict';

/**
 * POST-IT bot logic.
 *
 * Send the bot any text and it sticks it on the board as a note.
 * Commands let you browse, search and remove notes.
 */

const { Telegraf, Markup } = require('telegraf');
const store = require('./notes');

const LIST_PAGE_SIZE = 20;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** Render notes (already newest-first) as numbered sticky notes. */
function renderNoteList(notes, { offset = 0 } = {}) {
  if (notes.length === 0) {
    return '🗒️ Your board is empty.\n\nSend me any text and I\'ll stick it here as a note.';
  }
  const shown = notes.slice(0, LIST_PAGE_SIZE);
  const lines = shown.map((note, i) => {
    const num = offset + i + 1;
    const when = formatDate(note.createdAt);
    return [
      `📌 <b>Post-it #${num}</b> <i>(id ${note.id}${when ? `, ${when}` : ''})</i>`,
      escapeHtml(note.text),
    ].join('\n');
  });
  const header = `<b>🗒️ Your post-its</b> (${notes.length} total, newest first)`;
  const footer =
    notes.length > shown.length
      ? `\n\n<i>…and ${notes.length - shown.length} more. Use /find &lt;word&gt; to search.</i>`
      : '';
  const hint = '\n\n<i>Remove one with /delete &lt;number&gt;</i>';
  return `${header}\n\n${lines.join('\n\n')}${footer}${hint}`;
}

async function sendNoteList(ctx) {
  const notes = store.listNotes(ctx.chat.id).reverse();
  await ctx.replyWithHTML(renderNoteList(notes));
}

function createBot(token) {
  const bot = new Telegraf(token, { handlerTimeout: 90_000 });

  // ---------- commands ----------

  bot.start(async (ctx) => {
    await ctx.replyWithHTML(
      [
        '👋 <b>Hi, I\'m POST-IT!</b>',
        '',
        'Send me <b>any text</b> and I\'ll stick it on your board — like a sticky note that never falls off.',
        '',
        '<b>Commands</b>',
        '• /notes — see all your post-its (newest first)',
        '• /find &lt;word&gt; — search your notes',
        '• /delete &lt;number&gt; — remove a note by its number',
        '• /clear confirm — wipe the whole board',
        '• /help — full guide',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('🗒️ My notes', 'show_notes'), Markup.button.callback('❓ Help', 'show_help')],
      ]),
    );
  });

  bot.help(async (ctx) => {
    await ctx.replyWithHTML(
      [
        '<b>🗒️ POST-IT — your sticky-note bot</b>',
        '',
        '<b>How it works</b>',
        'Just message me. Every plain text you send becomes a post-it on your board.',
        '',
        '<b>Commands</b>',
        '• /notes — list all notes (newest first)',
        '• /find &lt;word&gt; — search notes for a word',
        '• /delete &lt;number&gt; — delete note #&lt;number&gt; as shown in /notes',
        '• /clear confirm — delete ALL your notes (needs confirmation)',
        '',
        '<b>Good to know</b>',
        '• Notes are private — only you (this chat) can see them.',
        '• Links, lists, ideas, grocery items… anything text goes.',
        '• Notes survive restarts and redeploys.',
      ].join('\n'),
    );
  });

  bot.command('notes', sendNoteList);

  bot.command('find', async (ctx) => {
    const query = ctx.message.text.split(/\s+/).slice(1).join(' ');
    if (!query) {
      await ctx.replyWithHTML('Usage: <code>/find &lt;word&gt;</code> — e.g. <code>/find grocery</code>');
      return;
    }
    const results = store.findNotes(ctx.chat.id, query);
    if (results.length === 0) {
      await ctx.replyWithHTML(`🔍 No post-its match <b>${escapeHtml(query)}</b>.`);
      return;
    }
    await ctx.replyWithHTML(
      `🔍 <b>${results.length}</b> match(es) for <b>${escapeHtml(query)}</b>:\n\n` +
        results
          .map((note, i) => `📌 <b>#${i + 1}</b> (id ${note.id})\n${escapeHtml(note.text)}`)
          .join('\n\n'),
    );
  });

  bot.command(['delete', 'done', 'rm'], async (ctx) => {
    const raw = ctx.message.text.split(/\s+/)[1];
    const num = Number.parseInt(raw, 10);
    if (!raw || !Number.isInteger(num) || num < 1) {
      await ctx.replyWithHTML('Usage: <code>/delete &lt;number&gt;</code> — the number shown in /notes (1 = newest).');
      return;
    }
    const removed = store.deleteNote(ctx.chat.id, num);
    if (!removed) {
      await ctx.replyWithHTML(`🤷 No note #${num}. Check the numbers in <code>/notes</code>.`);
      return;
    }
    await ctx.replyWithHTML(
      `🗑️ Deleted post-it #${num}:\n<pre>${escapeHtml(removed.text.slice(0, 200))}</pre>`,
    );
  });

  bot.command('clear', async (ctx) => {
    const confirmed = /^\/clear(\s+confirm)?$/i.exec(ctx.message.text.trim());
    if (confirmed && !/confirm/i.test(confirmed[0])) {
      const count = store.listNotes(ctx.chat.id).length;
      if (count === 0) {
        await ctx.reply('Your board is already empty. ✨');
        return;
      }
      await ctx.replyWithHTML(
        `⚠️ This will delete all <b>${count}</b> post-its. If you\'re sure, send <code>/clear confirm</code>.`,
      );
      return;
    }
    const count = store.clearNotes(ctx.chat.id);
    await ctx.reply(
      count > 0
        ? `🧹 Done — removed ${count} post-it(s). Fresh board!`
        : 'Your board is already empty. ✨',
    );
  });

  // ---------- inline keyboard actions ----------

  bot.action('show_notes', async (ctx) => {
    await ctx.answerCbQuery();
    await sendNoteList(ctx);
  });

  bot.action('show_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      [
        '<b>🗒️ POST-IT quick guide</b>',
        '',
        '• Send any text → it becomes a post-it',
        '• /notes — list notes',
        '• /find &lt;word&gt; — search',
        '• /delete &lt;number&gt; — remove one',
        '• /clear confirm — wipe the board',
      ].join('\n'),
    );
  });

  // ---------- plain text → new note ----------

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) {
      await ctx.replyWithHTML(
        '🤔 Unknown command. Try <code>/help</code> — or just send me plain text to save it as a note.',
      );
      return;
    }
    if (text.length > store.MAX_NOTE_LENGTH) {
      await ctx.replyWithHTML(
        `📏 That's a long one! Notes are capped at ${store.MAX_NOTE_LENGTH} characters — this one is ${text.length}.`,
      );
      return;
    }
    const note = store.addNote(ctx.chat.id, text);
    const total = store.listNotes(ctx.chat.id).length;
    await ctx.replyWithHTML(
      `📌 <b>Stuck it on your board</b> (post-it #${total}, id ${note.id}).\nSend /notes to see your board.`,
    );
  });

  // Photos, stickers, voice, etc.
  bot.on('message', async (ctx) => {
    await ctx.reply('🙂 Right now I can only stick <b>text</b> on your board — send it as a message.', {
      parse_mode: 'HTML',
    });
  });

  bot.catch((err, ctx) => {
    console.error(`[bot] Error while handling update ${ctx.update?.update_id}:`, err);
  });

  return bot;
}

module.exports = { createBot };
