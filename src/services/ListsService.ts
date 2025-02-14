import { Collection, ObjectId } from 'mongodb';
import type { NoId } from '../connections/mongo.js';

export type ListItem = {
    id: string;
    content: string;
    checked: boolean;
    createdAt: string;
    updatedAt: string;
    noteId?: string;
}

export type List = {
    id: string;
    name: string;
    items: ListItem[];
    createdAt: string;
    updatedAt: string;
}

export class ListsService {
    constructor(
        private readonly listCollection: Collection<NoId<List>>
    ) { }

    async getAllLists(): Promise<List[]> {
        const results = await this.listCollection.find().sort({ createdAt: -1 }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async getListById(id: string): Promise<List | null> {
        const result = await this.listCollection.findOne({ _id: new ObjectId(id) });
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async createList(name: string): Promise<List> {
        const newList = {
            name,
            items: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await this.listCollection.insertOne(newList);
        return { ...newList, id: result.insertedId.toString() };
    }

    async addItemToList(listId: string, content: string): Promise<List> {
        const newItem: Omit<ListItem, 'id'> = {
            content,
            checked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await this.listCollection.findOneAndUpdate(
            { _id: new ObjectId(listId) },
            {
                $push: { items: { ...newItem, id: new ObjectId().toString() } },
                $set: { updatedAt: new Date().toISOString() }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error(`List with id ${listId} not found`);
        }

        return { ...result, id: result._id.toString() };
    }

    async toggleItemCheck(listId: string, itemId: string): Promise<List> {
        const list = await this.getListById(listId);
        if (!list) throw new Error(`List ${listId} not found`);

        const itemIndex = list.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) throw new Error(`Item ${itemId} not found in list ${listId}`);

        const result = await this.listCollection.findOneAndUpdate(
            { _id: new ObjectId(listId), "items.id": itemId },
            {
                $set: {
                    "items.$.checked": !list.items[itemIndex].checked,
                    "items.$.updatedAt": new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) throw new Error(`Failed to update item ${itemId}`);
        return { ...result, id: result._id.toString() };
    }

    async addNoteToItem(listId: string, itemId: string, noteId: string): Promise<List> {
        const result = await this.listCollection.findOneAndUpdate(
            { _id: new ObjectId(listId), "items.id": itemId },
            {
                $set: {
                    "items.$.noteId": noteId,
                    "items.$.updatedAt": new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) throw new Error(`Failed to add note to item ${itemId}`);
        return { ...result, id: result._id.toString() };
    }

    async deleteItem(listId: string, itemId: string): Promise<List> {
        const result = await this.listCollection.findOneAndUpdate(
            { _id: new ObjectId(listId) },
            {
                $pull: { items: { id: itemId } },
                $set: { updatedAt: new Date().toISOString() }
            },
            { returnDocument: 'after' }
        );

        if (!result) throw new Error(`Failed to delete item ${itemId} from list ${listId}`);
        return { ...result, id: result._id.toString() };
    }
}