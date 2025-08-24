import { Collection, ObjectId } from 'mongodb';

import type { NoId } from '../connections/mongo.ts';

export type ReadingListItem = {
  id: string;
  name: string;
  url?: string;
  type: 'article' | 'book';
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export class ReadingListService {
  constructor(private readonly readingListCollection: Collection<NoId<ReadingListItem>>) {}

  async getAllItems(): Promise<ReadingListItem[]> {
    const results = await this.readingListCollection.find().sort({ createdAt: -1 }).toArray();
    return results.map((result) => ({ ...result, id: result._id.toString() }));
  }

  async getItemById(id: string): Promise<ReadingListItem | null> {
    const result = await this.readingListCollection.findOne({ _id: new ObjectId(id) });
    return result ? { ...result, id: result._id.toString() } : null;
  }

  async createItem(
    item: Omit<ReadingListItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReadingListItem> {
    const newItem: NoId<ReadingListItem> = {
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.readingListCollection.insertOne(newItem);
    return { ...newItem, id: result.insertedId.toString() };
  }

  async updateItem(
    id: string,
    update: Partial<Omit<ReadingListItem, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ReadingListItem> {
    const updateDoc = {
      $set: {
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };
    const result = await this.readingListCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateDoc,
      { returnDocument: 'after' },
    );
    if (!result) {
      throw new Error(`Reading list item with id ${id} not found`);
    }
    return { ...result, id: result._id.toString() };
  }

  async deleteItem(id: string): Promise<boolean> {
    const result = await this.readingListCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async getItemsByType(type: 'article' | 'book'): Promise<ReadingListItem[]> {
    const results = await this.readingListCollection
      .find({ type })
      .sort({ createdAt: -1 })
      .toArray();
    return results.map((result) => ({ ...result, id: result._id.toString() }));
  }
}
