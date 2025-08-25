import { drive_v3 } from '@googleapis/drive';

import { GoogleService } from '../connections/google.ts';
import { GoogleDocConverter } from './GoogleDocConverter.ts';
import {
  GOOGLE_NOTE_TAG,
  GoogleNote,
  GoogleNoteMetadata,
  isGoogleNoteMetadata,
  Note,
  NoteMetadata,
} from './notes.ts';
import { NotesService } from './NotesService.js';

export class GoogleNoteService {
  constructor(
    private readonly notesService: NotesService,
    private readonly googleService: GoogleService,
  ) {}

  static isGoogleNote(note: Note): note is GoogleNote {
    const hasGoogleTag = note.tags?.includes(GOOGLE_NOTE_TAG) ?? false;
    const hasGoogleDocId = 'googleDocId' in note;

    return hasGoogleTag && hasGoogleDocId && note.content === '';
  }

  async getAllGoogleNotes(): Promise<GoogleNote[]> {
    const notes = await this.notesService.getNotesByTag(GOOGLE_NOTE_TAG);
    return notes.filter((note: Note): note is GoogleNote => 'googleDocId' in note);
  }

  async getAllGoogleNotesMetadata(): Promise<GoogleNoteMetadata[]> {
    const notes = await this.notesService.getNotesByTag(GOOGLE_NOTE_TAG);
    return notes.filter((note: Note): note is GoogleNote => 'googleDocId' in note);
  }

  async getGoogleNoteById(id: string): Promise<GoogleNote | null> {
    const note = await this.notesService.getNoteById(id);
    return note && 'googleDocId' in note ? (note as GoogleNote) : null;
  }

  async getAllNotesAndUntrackedGoogleDocs(
    userId: string,
  ): Promise<{ notes: NoteMetadata[]; googleDocs: drive_v3.Schema$File[] }> {
    const notesMetadata = await this.notesService.getAllNotesMetadata();
    const googleDocs = await this.googleService.getUserDocs(userId);
    const googleNoteMetadatas = notesMetadata.filter(isGoogleNoteMetadata);

    const filteredGoogleDocs = googleDocs.filter(
      (doc: drive_v3.Schema$File) =>
        !googleNoteMetadatas.some((note) => note.googleDocId === doc.id),
    );
    return { notes: notesMetadata, googleDocs: filteredGoogleDocs };
  }

  async saveContentFromGoogleDoc(id: string, userId: string): Promise<void> {
    const note = await this.getGoogleNoteById(id);

    if (!note) {
      throw new Error('Google Note not found');
    }

    // Get the raw Google Doc document
    const googleDoc = await this.googleService.getGoogleDoc(userId, note.googleDocId);

    // Convert to markdown
    const markdownContent = GoogleDocConverter.convertToMarkdown(googleDoc);

    await this.notesService.updateNote(id, { content: markdownContent });
  }

  /**
   * Fetch Google Doc content and store it in the note's googleDocContent field for merge staging.
   */
  async stageContentFromGoogleDoc(id: string, userId: string): Promise<GoogleNote> {
    const note = await this.getGoogleNoteById(id);

    if (!note) {
      throw new Error('Google Note not found');
    }

    const googleDoc = await this.googleService.getGoogleDoc(userId, note.googleDocId);
    const markdownContent = GoogleDocConverter.convertToMarkdown(googleDoc);

    const updated = await this.notesService.updateNote<GoogleNote>(id, {
      googleDocContent: markdownContent,
    });
    return updated as GoogleNote;
  }

  async createGoogleNoteForNote(note: Note, userId: string): Promise<GoogleNote> {
    const googleDocId = await this.googleService.createGoogleDoc(userId, note.title);
    return this.assignGoogleDocIdToNote(note, googleDocId);
  }

  async assignGoogleDocIdToNote(note: Note, googleDocId: string): Promise<GoogleNote> {
    const newTags = [...(note.tags || []), GOOGLE_NOTE_TAG];
    await this.notesService.updateNote<GoogleNote>(note.id, { googleDocId, tags: newTags });
    return note as GoogleNote;
  }

  async createGoogleNoteFromGoogleDocId(userId: string, googleDocId: string): Promise<GoogleNote> {
    try {
      // Fetch the document using GoogleService
      const doc = await this.googleService.getGoogleDoc(userId, googleDocId);

      const newNote = await this.notesService.createNote<GoogleNote>({
        title: doc.title || doc.name || '',
        content: '',
        date: new Date().toISOString(),
        googleDocId,
        googleDocContent: '',
      });

      await this.notesService.addTag(newNote.id, GOOGLE_NOTE_TAG);
      return newNote;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create Google Note: ${errorMessage}`);
    }
  }

  async updateGoogleNote(
    id: string,
    update: Partial<Omit<GoogleNote, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<GoogleNote> {
    const result = await this.notesService.updateNote(id, update);
    return result as GoogleNote;
  }

  async deleteGoogleNote(id: string): Promise<boolean> {
    return this.notesService.deleteNote(id);
  }
}
