import { GoogleService } from '../connections/google.ts';
import { NotesService, Note } from './NotesService.ts';
import { GoogleNoteService, GoogleNote } from './GoogleNoteService.ts';
import { MarkdownToGoogleDocConverter } from './MarkdownToGoogleDocConverter.ts';
import { Logger } from 'pino';

export interface PushToGoogleResult {
    success: boolean;
    googleDocId: string;
    googleDocUrl: string;
    isNewDocument: boolean;
    error?: string;
}

export class GooglePushService {
    constructor(
        private readonly googleService: GoogleService,
        private readonly notesService: NotesService,
        private readonly googleNoteService: GoogleNoteService,
        private readonly logger: Logger
    ) {}

    /**
     * Push a note to Google Drive
     * - If it's already a Google note, add a new tab/section to the existing document
     * - If it's a regular note, create a new Google document and optionally convert to Google note
     */
    async pushNoteToGoogleDrive(
        noteId: string,
        userId: string,
        options: {
            convertToGoogleNote?: boolean;
            tabName?: string;
        } = {}
    ): Promise<PushToGoogleResult> {
        try {
            const note = await this.notesService.getNoteById(noteId);
            if (!note) {
                throw new Error('Note not found');
            }

            this.logger.info({ noteId, userId, options }, 'Pushing note to Google Drive');

            // Convert markdown to Google Docs format
            const googleDocRequest = MarkdownToGoogleDocConverter.convertToGoogleDoc(
                note.content,
                note.title
            );

            // Check if this is already a Google note
            const isGoogleNote = note.tags?.includes('google-note');

            if (isGoogleNote) {
                return await this.addToExistingGoogleDoc(note as GoogleNote, googleDocRequest, userId, options.tabName);
            } else {
                return await this.createNewGoogleDoc(note, googleDocRequest, userId, options.convertToGoogleNote);
            }

        } catch (error) {
            this.logger.error(error, 'Error pushing note to Google Drive');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                googleDocId: '',
                googleDocUrl: '',
                isNewDocument: false,
                error: errorMessage
            };
        }
    }

    private async addToExistingGoogleDoc(
        note: GoogleNote,
        googleDocRequest: any,
        userId: string,
        tabName?: string
    ): Promise<PushToGoogleResult> {
        if (!note.googleDocId) {
            throw new Error('Google note missing googleDocId');
        }

        await this.googleService.addTabToGoogleDoc(
            userId,
            note.googleDocId,
            googleDocRequest.content,
            tabName || `Update - ${new Date().toLocaleDateString()}`
        );

        const googleDocUrl = `https://docs.google.com/document/d/${note.googleDocId}/edit`;

        return {
            success: true,
            googleDocId: note.googleDocId,
            googleDocUrl,
            isNewDocument: false
        };
    }

    private async createNewGoogleDoc(
        note: Note,
        googleDocRequest: any,
        userId: string,
        convertToGoogleNote: boolean = false
    ): Promise<PushToGoogleResult> {
        const googleDocId = await this.googleService.createGoogleDocWithContent(
            userId,
            note.title,
            googleDocRequest.content
        );

        const googleDocUrl = `https://docs.google.com/document/d/${googleDocId}/edit`;

        // Optionally convert the note to a Google note
        if (convertToGoogleNote) {
            await this.googleNoteService.assignGoogleDocIdToNote(note, googleDocId);
        }

        return {
            success: true,
            googleDocId,
            googleDocUrl,
            isNewDocument: true
        };
    }

    /**
     * Push multiple notes to a single Google Doc as separate sections
     */
    async pushMultipleNotesToGoogleDoc(
        noteIds: string[],
        userId: string,
        documentTitle: string
    ): Promise<PushToGoogleResult> {
        try {
            this.logger.info({ noteIds, userId, documentTitle }, 'Pushing multiple notes to Google Drive');

            const notes = await Promise.all(
                noteIds.map(id => this.notesService.getNoteById(id))
            );

            // Filter out null notes
            const validNotes = notes.filter((note): note is Note => note !== null);

            if (validNotes.length === 0) {
                throw new Error('No valid notes found');
            }

            // Combine all notes into sections
            const allContent: any[] = [];

            for (const note of validNotes) {
                // Add section header
                allContent.push({
                    paragraph: {
                        elements: [{
                            textRun: {
                                content: `\n--- ${note.title} ---\n\n`,
                                textStyle: { bold: true }
                            }
                        }],
                        paragraphStyle: {}
                    }
                });

                // Add note content
                const googleDocRequest = MarkdownToGoogleDocConverter.convertToGoogleDoc(note.content);
                allContent.push(...googleDocRequest.content);
            }

            const googleDocId = await this.googleService.createGoogleDocWithContent(
                userId,
                documentTitle,
                allContent
            );

            const googleDocUrl = `https://docs.google.com/document/d/${googleDocId}/edit`;

            return {
                success: true,
                googleDocId,
                googleDocUrl,
                isNewDocument: true
            };

        } catch (error) {
            this.logger.error(error, 'Error pushing multiple notes to Google Drive');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                googleDocId: '',
                googleDocUrl: '',
                isNewDocument: false,
                error: errorMessage
            };
        }
    }
}