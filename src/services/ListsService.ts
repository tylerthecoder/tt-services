import { Collection, ObjectId, WithId } from 'mongodb';

import type { NoId } from '../connections/mongo.js';

export type ListItem = {
  id: string;
  content: string;
  checked: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  noteId?: string;
};

export type List = {
  id: string;
  name: string;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
};

export const convertList = (list: WithId<NoId<List>>): List => {
  const id = list._id.toString();
  const allButId = Object.fromEntries(
    Object.entries(list).filter(([key]) => key !== '_id' && key !== 'items'),
  ) as NoId<List>;

  const newList: List = {
    ...allButId,
    id,
    items: list.items,
  };
  return newList;
};

export class ListsService {
  constructor(private readonly listCollection: Collection<NoId<List>>) {}

  async getListById(id: string): Promise<List | null> {
    const result = await this.listCollection.findOne({ _id: new ObjectId(id) });
    return result ? convertList(result) : null;
  }

  async getListByName(name: string): Promise<List | null> {
    const result = await this.listCollection.findOne({ name });
    return result ? convertList(result) : null;
  }

  async createList(name: string): Promise<List> {
    const newList = {
      name,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.listCollection.insertOne(newList);
    return convertList({ ...newList, _id: result.insertedId });
  }

  async addItemToList(listId: string, content: string): Promise<List> {
    const newItem: Omit<ListItem, 'id'> = {
      content,
      checked: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId) },
      {
        $push: { items: { ...newItem, id: new ObjectId().toString() } },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new Error(`List with id ${listId} not found`);
    }

    return convertList(result);
  }

  async toggleItemCheck(listId: string, itemId: string): Promise<List> {
    const list = await this.getListById(listId);
    if (!list) throw new Error(`List ${listId} not found`);

    const itemIndex = list.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) throw new Error(`Item ${itemId} not found in list ${listId}`);

    const result = await this.listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId), 'items.id': itemId },
      {
        $set: {
          'items.$.checked': !list.items[itemIndex].checked,
          'items.$.updatedAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new Error(`Failed to update item ${itemId}`);
    return convertList(result);
  }

  async addNoteToItem(listId: string, itemId: string, noteId: string): Promise<List> {
    const result = await this.listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId), 'items.id': itemId },
      {
        $set: {
          'items.$.noteId': noteId,
          'items.$.updatedAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new Error(`Failed to add note to item ${itemId}`);
    return convertList(result);
  }

  async deleteItem(listId: string, itemId: string): Promise<List> {
    const result = await this.listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId) },
      {
        $pull: { items: { id: itemId } },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new Error(`Failed to delete item ${itemId} from list ${listId}`);
    return convertList(result);
  }

  async archiveItem(listId: string, itemId: string): Promise<List> {
    const result = await this.listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId), 'items.id': itemId },
      {
        $set: {
          'items.$.archived': true,
          'items.$.updatedAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new Error(`Failed to archive item ${itemId} in list ${listId}`);
    return convertList(result);
  }

  async unarchiveItem(listId: string, itemId: string): Promise<List> {
    const result = await this.listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId), 'items.id': itemId },
      {
        $set: {
          'items.$.archived': false,
          'items.$.updatedAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new Error(`Failed to unarchive item ${itemId} in list ${listId}`);
    return convertList(result);
  }

  async getArchivedItems(listId: string): Promise<ListItem[]> {
    const list = await this.getListById(listId);
    if (!list) throw new Error(`List ${listId} not found`);

    return list.items.filter((item) => item.archived);
  }

  async getAllLists(includeArchived: boolean = false): Promise<List[]> {
    const results = await this.listCollection.find().sort({ createdAt: -1 }).toArray();
    const lists = results.map(convertList);

    if (!includeArchived) {
      // Filter out archived items from each list
      return lists.map((list) => ({
        ...list,
        items: list.items.filter((item) => !item.archived),
      }));
    }

    return lists;
  }
}
