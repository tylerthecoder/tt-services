import { afterAll, beforeAll, beforeEach, describe, expect, it, setDefaultTimeout } from 'bun:test';
import { type Collection, MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import type { NoId } from '../src/connections/mongo.ts';
import { DailyNoteService } from '../src/notes/DailyNoteService.ts';
import { DAILY_NOTE_TAG, type Note } from '../src/notes/notes.ts';
import { NotesService } from '../src/notes/NotesService.ts';

// Real MongoDB query semantics, with a disposable loopback server and no application credentials.
let mongo: MongoMemoryServer;
let client: MongoClient;
let collection: Collection<NoId<Note>>;
let notes: NotesService;
let daily: DailyNoteService;
const legacyId = new ObjectId();
const activeId = new ObjectId();
const deletedId = new ObjectId();
const day = '2026-10-07';
const activeIds = [legacyId.toHexString(), activeId.toHexString()].sort();

// The first run may need to download MongoDB.
setDefaultTimeout(120_000);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  client = await new MongoClient(mongo.getUri()).connect();
  collection = client.db('note-query-tests').collection<NoId<Note>>('notes');
  notes = new NotesService(collection);
  daily = new DailyNoteService(notes);
});

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  await collection.deleteMany({});
  const base = {
    title: 'Daily note',
    content: 'Keep this content',
    date: day,
    tags: [DAILY_NOTE_TAG],
    published: true,
    updatedAt: '2026-10-07T00:00:00.000Z',
  };
  await collection.insertMany([
    { ...base, _id: legacyId, createdAt: '2025-01-01T00:00:00.000Z' },
    { ...base, _id: activeId, deleted: false, createdAt: '2026-01-01T00:00:00.000Z' },
    // Newest record would win the old date lookup despite being deleted.
    {
      ...base,
      _id: deletedId,
      deleted: true,
      tags: [DAILY_NOTE_TAG, 'deleted-only'],
      createdAt: '2030-01-01T00:00:00.000Z',
    },
  ]);
});

describe('active note queries', () => {
  const lists = [
    ['all notes', () => notes.getAllNotes()],
    ['all metadata', () => notes.getAllNotesMetadata()],
    ['tag metadata', () => notes.getNotesMetadataByTag(DAILY_NOTE_TAG)],
    ['published notes', () => notes.getPublishedNotes()],
    ['date lookup', () => notes.getNotesByDate(day)],
    ['tag lookup', () => notes.getNotesByTag(DAILY_NOTE_TAG)],
    ['batch ID lookup', () => notes.getNotesByIds([deletedId, legacyId, activeId].map(String))],
    ['daily calendar metadata', () => daily.getAllNotesMetadata()],
  ] as const;
  for (const [label, read] of lists) {
    it(`${label} excludes deleted records and keeps both legacy and explicitly active records`, async () => {
      const results = await read();
      expect(results.map((note) => note.id).sort()).toEqual(activeIds);
      expect(await collection.countDocuments()).toBe(3);
      expect((await collection.findOne({ _id: deletedId }))?.deleted).toBe(true);
    });
  }

  it('does not open deleted notes through direct content or metadata URLs', async () => {
    expect(await notes.getNoteById(String(deletedId))).toBeNull();
    expect(await notes.getNoteMetadataById(String(deletedId))).toBeNull();
    for (const id of [legacyId, activeId]) {
      expect((await notes.getNoteById(String(id)))?.id).toBe(String(id));
      const metadata = await notes.getNoteMetadataById(String(id));
      expect(metadata?.id).toBe(String(id));
      expect(metadata).not.toHaveProperty('content');
    }
  });

  it('respects tag/date/ID predicates and excludes deleted-only tags', async () => {
    expect(await notes.getNotesByTag('missing')).toEqual([]);
    expect(await notes.getNotesByDate('2000-01-01')).toEqual([]);
    expect(await notes.getNotesByIds([])).toEqual([]);
    expect(await notes.getAllTags()).toEqual([DAILY_NOTE_TAG]);
  });

  it('selects an active daily note instead of a newer deleted duplicate', async () => {
    expect((await daily.getToday(new Date(`${day}T12:00:00Z`))).id).toBe(String(activeId));
    expect(await collection.countDocuments()).toBe(3);
  });

  it('creates a fresh daily note when only a deleted one exists without restoring it', async () => {
    await collection.deleteMany({ deleted: { $ne: true } });
    const created = await daily.getToday(new Date(`${day}T12:00:00Z`));
    expect(created.id).not.toBe(String(deletedId));
    expect(created.tags).toContain(DAILY_NOTE_TAG);
    expect(created.content).toBe('');
    expect(await collection.countDocuments()).toBe(2);
    expect((await collection.findOne({ _id: deletedId }))?.deleted).toBe(true);
    expect((await daily.getAllNotesMetadata()).map((note) => note.id)).toEqual([created.id]);
  });

  it('retains explicit restoration through updateNote', async () => {
    await notes.updateNote(String(deletedId), { deleted: false });
    expect((await notes.getNoteById(String(deletedId)))?.content).toBe('Keep this content');
  });
});
