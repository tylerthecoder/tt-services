import { Note, NotesService } from './NotesService.ts';

export type Techie = Note<{ url?: string }>;

export class TechieService {
    private static readonly TECHIE_TAG = 'techie';

    constructor(private readonly notesService: NotesService) {}

    async getAllTechies(): Promise<Techie[]> {
        const notes = await this.notesService.getNotesByTag(TechieService.TECHIE_TAG);
        return notes.filter((note): note is Techie => 'url' in note);
    }

    async getTechieById(id: string): Promise<Techie | null> {
        const note = await this.notesService.getNoteById(id);
        return note && 'url' in note ? note as Techie : null;
    }

    async createTechie(techie: Pick<Techie, 'title' | 'url'>): Promise<Techie> {
        const newNote = await this.notesService.createNote<Techie>({
            title: techie.title,
            content: '',
            date: new Date().toISOString(),
            url: techie.url
        });

        await this.notesService.addTag(newNote.id, TechieService.TECHIE_TAG);
        return newNote;
    }

    async updateTechie(id: string, update: Partial<Omit<Techie, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Techie | null> {
        const result = await this.notesService.updateNote(id, update);
        return result as Techie;
    }

    async deleteTechie(id: string): Promise<boolean> {
        return this.notesService.deleteNote(id);
    }
}