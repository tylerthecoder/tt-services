import { Collection, ObjectId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';

export type Note<ExtraFields = {}> = {
    id: string;
    title: string;
    content: string;
    date: string;
    published: boolean;
    createdAt: string;
    updatedAt: string;
    tags?: string[];
} & ExtraFields

export type NoteMetadata = Omit<Note, 'content'>;

export class NotesService {
  constructor(
    private readonly noteCollection: Collection<NoId<Note>>
  ) {}

  async getAllNotes(): Promise<Note[]> {
    const results = await this.noteCollection.find().sort({ date: -1 }).toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }

  async getAllNotesMetadata(): Promise<NoteMetadata[]> {
    const results = await this.noteCollection.find({}, { projection: { content: 0 } }).sort({ date: -1 }).toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }

  async getPublishedNotes(): Promise<Note[]> {
    const results = await this.noteCollection
      .find({ published: true })
      .sort({ date: -1 })
      .toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }

  async getNoteById(id: string): Promise<Note | null> {
    const result = await this.noteCollection.findOne({ _id: new ObjectId(id) });
    return result ? { ...result, id: result._id.toString() } : null;
  }

  async createNote<T extends Note>(note: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'published' | 'tags'>): Promise<T> {
    const newNote = {
      ...note,
      tags: [],
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as NoId<Note>;

    const result = await this.noteCollection.insertOne(newNote);
    return { ...newNote, id: result.insertedId.toString() } as T;
  }

  async updateNote(id: string, update: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Note> {
    const updateDoc = {
      $set: {
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };

    const result = await this.noteCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateDoc,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Note with id ${id} not found`);
    }

    return { ...result, id: result._id.toString() };
  }

  async publishNote(id: string): Promise<Note> {
    return this.updateNote(id, { published: true });
  }

  async unpublishNote(id: string): Promise<Note> {
    return this.updateNote(id, { published: false });
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = await this.noteCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async getNotesByDate(date: string): Promise<Note[]> {
    const results = await this.noteCollection
      .find({ date: date })
      .sort({ createdAt: -1 })
      .toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }

  async addTag(id: string, tag: string): Promise<Note> {
    const note = await this.getNoteById(id);
    if (!note) throw new Error(`Note ${id} not found`);

    const tags = [...(note.tags || [])];
    if (!tags.includes(tag)) {
        tags.push(tag);
    }

    return this.updateNote(id, { tags });
  }

  async removeTag(id: string, tag: string): Promise<Note> {
    const note = await this.getNoteById(id);
    if (!note) throw new Error(`Note ${id} not found`);

    const tags = (note.tags || []).filter(t => t !== tag);
    return this.updateNote(id, { tags });
  }

  async getNotesByTag(tag: string): Promise<Note[]> {
    const results = await this.noteCollection
        .find({ tags: tag })
        .sort({ createdAt: -1 })
        .toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }
}
