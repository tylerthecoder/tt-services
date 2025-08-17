import { Collection, ObjectId, WithId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';

export type Jot = {
    id: string;
    text: string;
    createdAt: string;
}

const convertJot = (jot: WithId<NoId<Jot>>): Jot => {
    const id = jot._id.toString();
    const allButId = Object.fromEntries(
        Object.entries(jot).filter(([key]) => key !== '_id')
    ) as NoId<Jot>;
    return { ...allButId, id };
};

export class JotsService {
    constructor(
        private readonly jotsCollection: Collection<NoId<Jot>>
    ) { }

    async getAllJots(): Promise<Jot[]> {
        // Sort by creation date descending to get newest first
        const results = await this.jotsCollection.find().sort({ createdAt: -1 }).toArray();
        return results.map(convertJot);
    }

    async createJot(text: string): Promise<Jot> {
        const newJot: NoId<Jot> = {
            text,
            createdAt: new Date().toISOString(),
        };

        const result = await this.jotsCollection.insertOne(newJot);
        return convertJot({ ...newJot, _id: result.insertedId });
    }

    async deleteJot(id: string): Promise<boolean> {
        const result = await this.jotsCollection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount === 1;
    }
}
