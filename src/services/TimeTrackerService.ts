import { Collection, ObjectId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';

export type TimeBlock = {
    id: string;
    startTime: string; // ISO string
    endTime?: string; // ISO string, optional
    label: string;
    createdAt: string;
    updatedAt: string;
}

export class TimeTrackerService {
    constructor(
        private readonly timeBlockCollection: Collection<NoId<TimeBlock>>
    ) { }

    private async getCurrentTimeBlock(): Promise<TimeBlock | null> {
        console.log('Getting current time block');
        const result = await this.timeBlockCollection.findOne({
            endTime: { $exists: false }
        });
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async startTimeBlock(label: string): Promise<TimeBlock> {
        console.log('Starting time block');
        const currentBlock = await this.getCurrentTimeBlock();
        if (currentBlock) {
            throw new Error('Cannot start a new time block while another is in progress');
        }

        const newBlock: NoId<TimeBlock> = {
            startTime: new Date().toISOString(),
            label,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await this.timeBlockCollection.insertOne(newBlock);
        return { ...newBlock, id: result.insertedId.toString() };
    }

    async endTimeBlock(): Promise<TimeBlock> {
        console.log('Ending time block');
        const currentBlock = await this.getCurrentTimeBlock();
        if (!currentBlock) {
            throw new Error('No time block currently in progress');
        }

        const endTime = new Date().toISOString();
        const result = await this.timeBlockCollection.findOneAndUpdate(
            { _id: new ObjectId(currentBlock.id) },
            {
                $set: {
                    endTime,
                    updatedAt: new Date().toISOString(),
                },
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error(`Failed to end time block with id ${currentBlock.id}`);
        }

        return { ...result, id: result._id.toString() };
    }

    async getTimeBlocksForDay(date: string): Promise<TimeBlock[]> {
        console.log('Getting time blocks for day');
        // Create start and end of day in ISO format
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Find blocks that either:
        // 1. Start within this day
        // 2. End within this day
        // 3. Span across this day (start before and end after)
        const results = await this.timeBlockCollection.find({
            $or: [
                { startTime: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
                { endTime: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
                {
                    $and: [
                        { startTime: { $lte: startOfDay.toISOString() } },
                        {
                            $or: [
                                { endTime: { $gte: endOfDay.toISOString() } },
                                { endTime: { $exists: false } }
                            ]
                        }
                    ]
                }
            ]
        }).sort({ startTime: -1 }).toArray();

        return results.map(result => ({ ...result, id: result._id.toString() }));
    }
}
