'use strict';

/**
 * Simple JSON-file storage for POST-IT notes.
 * Shape: { [chatId]: [{ id, text, createdAt }] }
 * Notes are stored oldest-first; the UI shows newest-first (note #1 = newest).
 *
 * No database needed — just a single JSON file that is written atomically.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'notes.json');

const MAX_NOTE_LENGTH = 3500; // keep under Telegram's 4096-char message limit

let db = {};

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error(`[storage] Could not read ${DATA_FILE}, starting fresh: ${err.message}`);
    db = {};
  }
}

function save() {
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function notesFor(chatId) {
  if (!db[chatId]) db[chatId] = [];
  return db[chatId];
}

/** Return copies of a chat's notes, oldest-first. */
function listNotes(chatId) {
  return notesFor(chatId).map((n) => ({ ...n }));
}

/** Add a note. Returns the created note. */
function addNote(chatId, text) {
  const notes = notesFor(chatId);
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const nextId = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  const note = {
    id: nextId,
    text: trimmed.slice(0, MAX_NOTE_LENGTH),
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  save();
  return { ...note };
}

/** Delete by display number (1 = newest). Returns the removed note or null. */
function deleteNote(chatId, displayNumber) {
  const notes = notesFor(chatId);
  const idx = notes.length - Number(displayNumber);
  if (!Number.isInteger(idx) || idx < 0 || idx >= notes.length) return null;
  const [removed] = notes.splice(idx, 1);
  save();
  return { ...removed };
}

/** Case-insensitive substring search over a chat's notes (newest-first). */
function findNotes(chatId, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return listNotes(chatId)
    .reverse()
    .filter((n) => n.text.toLowerCase().includes(q));
}

/** Remove all notes for a chat. Returns how many were removed. */
function clearNotes(chatId) {
  const count = notesFor(chatId).length;
  db[chatId] = [];
  save();
  return count;
}

module.exports = {
  init,
  listNotes,
  addNote,
  deleteNote,
  findNotes,
  clearNotes,
  MAX_NOTE_LENGTH,
};
