import { Collection, ObjectId } from 'mongodb';
import { NoId } from '../connections/mongo.ts';

export type TalkNote = {
    id: string;
    title: string;
    content: string;
    speaker: string;
    date: string;
    createdAt: string;
    updatedAt: string;
}

export class TalkNotesService {
  constructor(private readonly talkNoteCollection: Collection<NoId<TalkNote>>) {}

  async getAllNotes(): Promise<TalkNote[]> {
    const results = await this.talkNoteCollection.find().sort({ createdAt: -1 }).toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }

  async getNoteById(id: string): Promise<TalkNote | null> {
    const result = await this.talkNoteCollection.findOne({ _id: new ObjectId(id) });
    return result ? { ...result, id: result._id.toString() } : null;
  }

  async createNote(note: Omit<TalkNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<TalkNote> {
    const newItem: NoId<TalkNote> = {
      ...note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await this.talkNoteCollection.insertOne(newItem);
    return { ...newItem, id: result.insertedId.toString() };
  }

  async updateNote(id: string, update: Partial<Omit<TalkNote, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TalkNote | null> {
    const updateDoc = {
      $set: {
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };
    const result = await this.talkNoteCollection.findOneAndUpdate({ _id: new ObjectId(id) }, updateDoc, { returnDocument: 'after' });
    return result ? { ...result, id: result._id.toString() } : null;
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = await this.talkNoteCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async getNotesByDate(date: string): Promise<TalkNote[]> {
    const results = await this.talkNoteCollection.find({ date }).sort({ createdAt: -1 }).toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }
}

