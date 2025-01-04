import { Collection, ObjectId } from 'mongodb';
import { NoId } from '../connections/mongo.ts';

export type WeekendProject = {
    id: string;
    title: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export class WeekendProjectService {
    constructor(private readonly weekendProjectCollection: Collection<NoId<WeekendProject>>) {}

    async getAllWeekendProjects(): Promise<WeekendProject[]> {
        const results = await this.weekendProjectCollection.find().sort({ createdAt: -1 }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async getWeekendProjectById(id: string): Promise<WeekendProject | null> {
        const result = await this.weekendProjectCollection.findOne({ _id: new ObjectId(id) });
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async createWeekendProject(project: Pick<WeekendProject, 'title'>): Promise<WeekendProject> {
        const newProject: NoId<WeekendProject> = {
            ...project,
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const result = await this.weekendProjectCollection.insertOne(newProject);
        return { ...newProject, id: result.insertedId.toString() };
    }

    async updateWeekendProject(id: string, update: Partial<Omit<WeekendProject, 'id' | 'createdAt' | 'updatedAt'>>): Promise<WeekendProject | null> {
        const updateDoc = {
            $set: {
                ...update,
                updatedAt: new Date().toISOString(),
            },
        };
        const result = await this.weekendProjectCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async deleteWeekendProject(id: string): Promise<boolean> {
        const result = await this.weekendProjectCollection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount === 1;
    }
}