import { Collection, ObjectId } from 'mongodb';

import type { NoId } from '../connections/mongo.ts';

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export class TodoService {
  constructor(private readonly todoCollection: Collection<NoId<Todo>>) {}

  async getAllTodos(): Promise<Todo[]> {
    const results = await this.todoCollection.find().toArray();
    return results.map((result) => ({ ...result, id: result._id.toString() }));
  }

  async createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const newTodo: NoId<Todo> = {
      ...todo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await this.todoCollection.insertOne(newTodo);
    return { ...newTodo, id: result.insertedId.toString() };
  }

  async updateTodo(
    id: string,
    update: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Todo> {
    const updateDoc = {
      $set: {
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };
    const result = await this.todoCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateDoc,
      { returnDocument: 'after' },
    );
    if (!result) {
      throw new Error(`Todo with id ${id} not found`);
    }
    return { ...result, id: result._id.toString() };
  }

  async deleteTodo(id: string): Promise<boolean> {
    const result = await this.todoCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async getTodosByStatus(completed: boolean): Promise<Todo[]> {
    const results = await this.todoCollection.find({ completed }).toArray();
    return results.map((result) => ({ ...result, id: result._id.toString() }));
  }
}
