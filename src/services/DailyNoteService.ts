import { DAILY_NOTE_TAG, DailyNote, NoteMetadata } from './notes.ts';
import { NotesService } from './NotesService.ts';

export class DailyNoteService {

  constructor(private readonly notesService: NotesService) { }

  // Helper to get the start of the day (YYYY-MM-DD)
  private getDayString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  async getToday(date: Date = new Date()): Promise<DailyNote> {
    const dayString = this.getDayString(date);
    const notes = await this.notesService.getNotesByDate(dayString);
    const dailyNotes = notes.filter((note) => note.tags?.includes(DAILY_NOTE_TAG));

    if (dailyNotes.length > 0) {
      // Assume the first one is the primary daily note if multiple exist for some reason
      return dailyNotes[0] as DailyNote;
    }

    // If no daily note exists for today, create one
    const newNote = await this.notesService.createNote<DailyNote>({
      title: `Daily Note - ${dayString}`,
      content: '',
      date: dayString,
      day: dayString, // Add the specific day field
    });

    // Add the tag to identify it as a daily note
    await this.notesService.addTag(newNote.id, DAILY_NOTE_TAG);

    // Fetch the note again to get the tags included
    const createdNote = await this.notesService.getNoteById(newNote.id);
    if (!createdNote) {
      // Should not happen, but handle defensively
      throw new Error('Failed to retrieve newly created daily note.');
    }
    return createdNote as DailyNote;
  }

  async getAllNotesMetadata(): Promise<NoteMetadata[]> {
    const notes = await this.notesService.getNotesByTag(DAILY_NOTE_TAG);
    // Map to metadata, ensuring content is excluded
    return notes.map(({ content, ...metadata }) => metadata);
  }
}
