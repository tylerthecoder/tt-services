import { Collection, ObjectId } from 'mongodb';
import { NoId } from '../connections/mongo.ts';

export type Spark = {
    id: string;
    name: string;
    notes: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

export class SparksService {
    constructor(private readonly sparksCollection: Collection<NoId<Spark>>) {}

    async getAllSparks(): Promise<Spark[]> {
        const results = await this.sparksCollection.find().sort({ createdAt: -1 }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async getSparkById(id: string): Promise<Spark | null> {
        const result = await this.sparksCollection.findOne({ _id: new ObjectId(id) });
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async createSpark(spark: Pick<Spark, 'name'>): Promise<Spark> {
        const newSpark: NoId<Spark> = {
            ...spark,
            notes: '',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const result = await this.sparksCollection.insertOne(newSpark);
        return { ...newSpark, id: result.insertedId.toString() };
    }

    async updateSpark(id: string, update: Partial<Omit<Spark, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Spark | null> {
        const updateDoc = {
            $set: {
                ...update,
                updatedAt: new Date().toISOString(),
            },
        };
        const result = await this.sparksCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async deleteSpark(id: string): Promise<boolean> {
        const result = await this.sparksCollection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount === 1;
    }
}