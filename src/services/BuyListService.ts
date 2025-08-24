import { Collection, ObjectId } from 'mongodb';

import type { NoId } from '../connections/mongo.ts';

export type BuyListItem = {
  id: string;
  text: string;
  completed: boolean;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export class BuyListService {
  constructor(private readonly buyListCollection: Collection<NoId<BuyListItem>>) {}

  async getAllItems(): Promise<BuyListItem[]> {
    const results = await this.buyListCollection.find().toArray();
    return results.map((result) => ({ ...result, id: result._id.toString() }));
  }

  async createItem(
    item: Omit<BuyListItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BuyListItem> {
    const newItem: NoId<BuyListItem> = {
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.buyListCollection.insertOne(newItem);
    return { ...newItem, id: result.insertedId.toString() };
  }

  async updateItem(
    id: string,
    update: Partial<Omit<BuyListItem, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BuyListItem> {
    const updateDoc = {
      $set: {
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };
    const result = await this.buyListCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateDoc,
      { returnDocument: 'after' },
    );
    if (!result) {
      throw new Error(`Buy list item with id ${id} not found`);
    }
    return { ...result, id: result._id.toString() };
  }

  async deleteItem(id: string): Promise<boolean> {
    const result = await this.buyListCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async getItemsByStatus(completed: boolean): Promise<BuyListItem[]> {
    const results = await this.buyListCollection.find({ completed }).toArray();
    return results.map((result) => ({ ...result, id: result._id.toString() }));
  }
}
