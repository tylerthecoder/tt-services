import { Collection, ObjectId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';

export type Creation = {
    id: string;
    name: string;
    description: string;
    link: string;
    type: string;
    img: string;
    published: boolean; // Add this field
    createdAt: string;
    updatedAt: string;
}

export class CreationsService {
    constructor(
        private readonly creationsCollection: Collection<NoId<Creation>>
    ) { }

    async getAllCreations(): Promise<Creation[]> {
        const results = await this.creationsCollection.find().toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async getFeaturedCreations(): Promise<Creation[]> {
        const featuredNames = [
            "The Cookie Game",
            "Number Stats",
            "Rubik's Cube Simulator",
            "Battle Balls",
            "Derivative Dash",
            "RPS++",
        ];

        const results = await this.creationsCollection.find({
            name: { $in: featuredNames }
        }).toArray();

        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async createCreation(creation: Omit<Creation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Creation> {
        const newCreation: NoId<Creation> = {
            ...creation,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await this.creationsCollection.insertOne(newCreation);
        return { ...newCreation, id: result.insertedId.toString() };
    }

    async getCreationById(id: string): Promise<Creation> {
        const result = await this.creationsCollection.findOne({ _id: new ObjectId(id) });
        if (!result) {
            throw new Error(`Creation with id ${id} not found`);
        }
        return { ...result, id: result._id.toString() };
    }

    async updateCreation(id: string, update: Partial<Omit<Creation, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Creation> {
        const updateDoc = {
            $set: {
                ...update,
                updatedAt: new Date().toISOString(),
            },
        };
        const result = await this.creationsCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        if (!result) {
            throw new Error(`Creation with id ${id} not found`);
        }
        return { ...result, id: result._id.toString() };
    }

    async deleteCreation(id: string): Promise<boolean> {
        const result = await this.creationsCollection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount === 1;
    }

    async publishCreation(id: string): Promise<Creation> {
        const updateDoc = {
            $set: {
                published: true,
                updatedAt: new Date().toISOString(),
            },
        };
        const result = await this.creationsCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        if (!result) {
            throw new Error(`Creation with id ${id} not found`);
        }
        return { ...result, id: result._id.toString() };
    }

    async unpublishCreation(id: string): Promise<Creation> {
        const updateDoc = {
            $set: {
                published: false,
                updatedAt: new Date().toISOString(),
            },
        };
        const result = await this.creationsCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        if (!result) {
            throw new Error(`Creation with id ${id} not found`);
        }
        return { ...result, id: result._id.toString() };
    }

    async getPublishedCreations(): Promise<Creation[]> {
        const results = await this.creationsCollection.find({ published: true }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }
}
