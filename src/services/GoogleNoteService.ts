import { Note, NotesService } from './NotesService.js';
import { GoogleService } from '../connections/google.js';

export type GoogleNote = Note<{ googleDocId: string }>;

export class GoogleNoteService {
    private static readonly GOOGLE_NOTE_TAG = 'google-doc';

    constructor(
        private readonly notesService: NotesService,
        private readonly googleService: GoogleService
    ) { }

    async getAllGoogleNotes(): Promise<GoogleNote[]> {
        const notes = await this.notesService.getNotesByTag(GoogleNoteService.GOOGLE_NOTE_TAG);
        return notes.filter((note: Note): note is GoogleNote => 'googleDocId' in note);
    }

    async getGoogleNoteById(id: string): Promise<GoogleNote | null> {
        const note = await this.notesService.getNoteById(id);
        return note && 'googleDocId' in note ? note as GoogleNote : null;
    }

    async createGoogleNote(userId: string, googleDocId: string): Promise<GoogleNote> {
        try {
            // Fetch the document using GoogleService
            const doc = await this.googleService.getUserDocs(userId)
                .then(docs => docs.find(doc => doc.id === googleDocId));

            if (!doc || !doc.name) {
                throw new Error('Could not fetch Google Doc information');
            }

            const newNote = await this.notesService.createNote<GoogleNote>({
                title: doc.name,
                content: '',  // We don't store the content in our DB since it lives in Google Docs
                date: new Date().toISOString(),
                googleDocId,
            });

            await this.notesService.addTag(newNote.id, GoogleNoteService.GOOGLE_NOTE_TAG);
            return newNote;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to create Google Note: ${errorMessage}`);
        }
    }

    async updateGoogleNote(id: string, update: Partial<Omit<GoogleNote, 'id' | 'createdAt' | 'updatedAt'>>): Promise<GoogleNote> {
        const result = await this.notesService.updateNote(id, update);
        return result as GoogleNote;
    }

    async deleteGoogleNote(id: string): Promise<boolean> {
        return this.notesService.deleteNote(id);
    }

    async getGoogleDocContent(googleDocId: string): Promise<string> {
        try {
            // Use GoogleService to fetch document content
            const cookies = require('next/headers').cookies;
            const cookieStore = cookies();
            const userId = cookieStore.get('googleUserId')?.value;

            if (!userId) {
                throw new Error('User not authenticated with Google');
            }

            return await this.googleService.getDocContent(userId, googleDocId);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to fetch Google Doc content: ${errorMessage}`);
        }
    }
}