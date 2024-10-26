import { Collection, ObjectId } from 'mongodb';
import type { NoId } from '../connections/mongo.ts';

export type Plan = {
    id: string;
    day: string;
    createdAt: string;
    updatedAt: string;
    text: string;
}

function getCurrentDayBoundary(): Date {
  const now = new Date();
  const pstOffset = -7 * 60; // PST offset in minutes
  now.setMinutes(now.getMinutes() + now.getTimezoneOffset() + pstOffset);

  if (now.getHours() < 7) {
    now.setDate(now.getDate() - 1);
  }

  now.setHours(7, 0, 0, 0);
  return now;
}

export class DailyPlansService {

  constructor(
    private readonly planCollection: Collection<NoId<Plan>>
  ) {}

  async getToday(): Promise<Plan | null> {
    const today = getCurrentDayBoundary();
    return this.getPlanByDay(today);
  }

  async getPlanByDay(day: Date): Promise<Plan | null> {
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const result = await this.planCollection.findOne({
      day: {
        $gte: day.toISOString(),
        $lt: nextDay.toISOString()
      }
    });
    return result ? { ...result, id: result._id.toString() } : null;
  }

  async createPlan(plan: Omit<Plan, 'createdAt' | 'updatedAt' | 'id'>): Promise<Plan> {
    const newPlan: NoId<Plan> = {
      ...plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.planCollection.insertOne(newPlan);
    return { ...newPlan, id: result.insertedId.toString() };
  }

  async updatePlan(id: string, update: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Plan> {
    const updateDoc = {
      $set: {
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };
    const result = await this.planCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateDoc,
      { returnDocument: 'after' }
    );
    if (!result) {
      throw new Error(`Plan with id ${id} not found`);
    }
    return { ...result, id: result._id.toString() };
  }

  async getAllPlans(): Promise<Plan[]> {
    const results = await this.planCollection.find().sort({ day: -1 }).toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }

  async getAllPastPlans(today: Date): Promise<Plan[]> {
    const results = await this.planCollection
      .find({ day: { $lt: today.toISOString() } })
      .sort({ day: -1 })
      .toArray();
    return results.map(result => ({ ...result, id: result._id.toString() }));
  }
}
