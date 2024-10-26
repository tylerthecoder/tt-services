import { Collection, ObjectId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';

export type Note = {
    id: string;
    title: string;
    content: string;
    date: string;
    published: boolean;
    createdAt: string;
    updatedAt: string;
}

export class NotesService {
  constructor(
    private readonly noteCollection: Collection<NoId<Note>>
  ) {}

  async getAllNotes(): Promise<Note[]> {
    const results = await this.noteCollection.find().sort({ date: -1 }).toArray();
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

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'published'>): Promise<Note> {
    const newNote: NoId<Note> = {
      ...note,
      published: false, // Default to unpublished
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.noteCollection.insertOne(newNote);
    return { ...newNote, id: result.insertedId.toString() };
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
}
