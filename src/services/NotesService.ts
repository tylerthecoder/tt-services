import { Collection, ObjectId, WithId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';
import { CreatableNote, Note, NoteMetadata } from './notes.ts';


const convertNote = (note: WithId<NoId<Note>>): Note => {
  const new_note = {
    ...note,
    id: note._id.toString(),
  } as Note & { _id?: ObjectId };
  delete new_note._id;
  return new_note;
}

export class NotesService {
  constructor(
    private readonly noteCollection: Collection<NoId<Note>>
  ) { }

  async getAllNotes(): Promise<Note[]> {
    const results = await this.noteCollection.find({ deleted: { $ne: true } }).sort({ date: -1 }).toArray();
    return results.map(result => convertNote(result));
  }

  async getAllNotesMetadata(): Promise<NoteMetadata[]> {
    const results = await this.noteCollection
      .find({ deleted: { $ne: true } }, { projection: { content: 0 } })
      .sort({ date: -1 })
      .toArray();
    return results.map(result => convertNote(result));
  }

  async getPublishedNotes(): Promise<Note[]> {
    const results = await this.noteCollection
      .find({ published: true })
      .sort({ date: -1 })
      .toArray();
    return results.map(result => convertNote(result));
  }

  async getNoteById(id: string): Promise<Note | null> {
    const result = await this.noteCollection.findOne({ _id: new ObjectId(id) });
    return result ? convertNote(result) : null;
  }

  async getNotesByIds(ids: string[]): Promise<Note[]> {
    const results = await this.noteCollection.find({ _id: { $in: ids.map(id => new ObjectId(id)) } }).toArray();
    return results.map(result => convertNote(result));
  }

  async createNote<T extends Note>(note: CreatableNote<T>): Promise<T> {
    const newNote = {
      ...note,
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as NoId<Note>;

    const result = await this.noteCollection.insertOne(newNote);
    return { ...newNote, id: result.insertedId.toString() } as T;
  }

  async updateNote<T extends Note>(id: string, update: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
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

    return { ...result, id: result._id.toString() } as unknown as T;
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

  async softDeleteNote(id: string): Promise<boolean> {
    const result = await this.noteCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deleted: true,
          updatedAt: new Date().toISOString()
        }
      }
    );
    return result.modifiedCount === 1;
  }

  async getAllTags(): Promise<string[]> {
    // Get all unique tags from non-deleted notes
    const tags = await this.noteCollection.distinct('tags', { deleted: { $ne: true } });
    // Filter out any null or undefined values and sort alphabetically
    return tags.filter(tag => tag !== undefined).sort();
  }
}
