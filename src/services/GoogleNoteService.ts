import { docs_v1 } from '@googleapis/docs';
import { Note, NotesService } from './NotesService.js';
import { GoogleAuth } from 'google-auth-library';

export type GoogleNote = Note<{ googleDocId: string }>;

export class GoogleNoteService {
    private static readonly GOOGLE_NOTE_TAG = 'google-doc';
    private docs: docs_v1.Docs;
    private auth: GoogleAuth;

    constructor(private readonly notesService: NotesService) {
        const keyPath = import.meta.dirname + '/../../google-keys.json';
        console.log("Loading key from: ", keyPath);
        this.auth = new GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/drive'],
        });

        this.docs = new docs_v1.Docs({ auth: this.auth });
    }

    async getAllGoogleNotes(): Promise<GoogleNote[]> {
        const notes = await this.notesService.getNotesByTag(GoogleNoteService.GOOGLE_NOTE_TAG);
        return notes.filter((note: Note): note is GoogleNote => 'googleDocId' in note);
    }

    async getGoogleNoteById(id: string): Promise<GoogleNote | null> {
        const note = await this.notesService.getNoteById(id);
        return note && 'googleDocId' in note ? note as GoogleNote : null;
    }

    async createGoogleNote(googleDocId: string): Promise<GoogleNote> {
        try {
            // Fetch the document to get its title
            const doc = await this.docs.documents.get({
                documentId: googleDocId,
            });

            if (!doc.data.title) {
                throw new Error('Could not fetch Google Doc title');
            }

            const newNote = await this.notesService.createNote<GoogleNote>({
                title: doc.data.title,
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
            const doc = await this.docs.documents.get({
                documentId: googleDocId,
            });

            // This is a simple implementation - you might want to add more sophisticated
            // parsing of the Google Doc content structure
            return doc.data.body?.content
                ?.map(element => element.paragraph?.elements
                    ?.map(el => el.textRun?.content || '')
                    .join('') || '')
                .join('\n') || '';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to fetch Google Doc content: ${errorMessage}`);
        }
    }
}