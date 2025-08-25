import { Collection, ObjectId, WithId } from 'mongodb';

import type { NoId } from '../connections/mongo.ts';

export type TimeBlock = {
  id: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string, optional
  label: string;
  noteId?: string;
  createdAt: string;
  updatedAt: string;
};

const convertTimeBlock = (timeBlock: WithId<NoId<TimeBlock>>): TimeBlock => {
  const new_time_block = {
    ...timeBlock,
    id: timeBlock._id.toString(),
  } as TimeBlock & { _id?: ObjectId };
  delete new_time_block._id;
  return new_time_block;
};

export class TimeTrackerService {
  constructor(private readonly timeBlockCollection: Collection<NoId<TimeBlock>>) { }

  private async getCurrentTimeBlock(): Promise<TimeBlock | null> {
    console.log('Getting current time block');
    const result = await this.timeBlockCollection.findOne({
      endTime: { $exists: false },
    });
    return result ? convertTimeBlock(result as WithId<NoId<TimeBlock>>) : null;
  }

  async startTimeBlock(label: string, noteId?: string): Promise<TimeBlock> {
    console.log('Starting time block');
    const currentBlock = await this.getCurrentTimeBlock();
    if (currentBlock) {
      throw new Error('Cannot start a new time block while another is in progress');
    }

    const newBlock: NoId<TimeBlock> = {
      startTime: new Date().toISOString(),
      label,
      noteId,
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
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new Error(`Failed to end time block with id ${currentBlock.id}`);
    }

    return convertTimeBlock(result as WithId<NoId<TimeBlock>>);
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
    const results = await this.timeBlockCollection
      .find({
        $or: [
          { startTime: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
          { endTime: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
          {
            $and: [
              { startTime: { $lte: startOfDay.toISOString() } },
              {
                $or: [
                  { endTime: { $gte: endOfDay.toISOString() } },
                  { endTime: { $exists: false } },
                ],
              },
            ],
          },
        ],
      })
      .sort({ startTime: -1 })
      .toArray();

    return results.map((result) => convertTimeBlock(result as WithId<NoId<TimeBlock>>));
  }

  async getAllTimeBlocks(): Promise<TimeBlock[]> {
    console.log('Getting all time blocks');
    const results = await this.timeBlockCollection.find({}).sort({ startTime: -1 }).toArray();
    return results.map((result) => convertTimeBlock(result as WithId<NoId<TimeBlock>>));
  }

  async updateTimeBlock(
    id: string,
    updates: {
      startTime?: string;
      endTime?: string | null;
      label?: string;
      noteId?: string | null;
    },
  ): Promise<TimeBlock> {
    console.log('Updating time block', id);
    const setFields: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    const unsetFields: Record<string, ''> = {};

    if (typeof updates.startTime === 'string') {
      setFields.startTime = updates.startTime;
    }
    if (typeof updates.label === 'string') {
      setFields.label = updates.label;
    }
    if (updates.endTime === null) {
      unsetFields.endTime = '';
    } else if (typeof updates.endTime === 'string') {
      setFields.endTime = updates.endTime;
    }
    if (updates.noteId === null) {
      unsetFields.noteId = '';
    } else if (typeof updates.noteId === 'string') {
      setFields.noteId = updates.noteId;
    }

    const update: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length > 0) {
      (update as any).$unset = unsetFields;
    }

    const result = await this.timeBlockCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      update,
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new Error(`Failed to update time block with id ${id}`);
    }

    return convertTimeBlock(result as WithId<NoId<TimeBlock>>);
  }
}
