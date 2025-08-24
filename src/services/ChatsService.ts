import { Collection, ObjectId, WithId } from 'mongodb';

import type { NoId } from '../connections/mongo.ts';

export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  // Optional raw data associated with tool calls or state
  metadata?: Record<string, unknown>;
}

export interface Chat {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  // Serialized agent run state to resume conversations
  state?: unknown;
}

export type CreatableChat = Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'messages'> & {
  title?: string;
  firstMessage?: Omit<ChatMessage, 'id' | 'createdAt'> & { createdAt?: string };
};

const convertChat = (doc: WithId<NoId<Chat>>): Chat => {
  const chat = { ...doc, id: doc._id.toString() } as Chat & { _id?: ObjectId };
  delete (chat as any)._id;
  return chat;
};

export class ChatsService {
  constructor(private readonly chatsCollection: Collection<NoId<Chat>>) {}

  async listChats(): Promise<Chat[]> {
    const results = await this.chatsCollection
      .find({}, { projection: {} })
      .sort({ updatedAt: -1 })
      .toArray();
    return results.map(convertChat);
  }

  async getChatById(id: string): Promise<Chat | null> {
    const result = await this.chatsCollection.findOne({ _id: new ObjectId(id) });
    return result ? convertChat(result) : null;
  }

  async createChat(input?: CreatableChat): Promise<Chat> {
    const now = new Date().toISOString();
    const base: NoId<Chat> = {
      title: input?.title ?? 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
      state: undefined,
    };

    if (input?.firstMessage) {
      const msg: ChatMessage = {
        id: new ObjectId().toString(),
        role: input.firstMessage.role,
        content: input.firstMessage.content,
        createdAt: input.firstMessage.createdAt ?? now,
        metadata: input.firstMessage.metadata,
      };
      base.messages.push(msg);
    }

    const result = await this.chatsCollection.insertOne(base);
    return { ...base, id: result.insertedId.toString() };
  }

  async appendMessage(
    chatId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'> & { createdAt?: string },
  ): Promise<Chat> {
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: new ObjectId().toString(),
      role: message.role,
      content: message.content,
      createdAt: message.createdAt ?? now,
      metadata: message.metadata,
    };

    const result = await this.chatsCollection.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $push: { messages: msg },
        $set: { updatedAt: now },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new Error(`Chat ${chatId} not found`);
    return convertChat(result);
  }

  async updateState(chatId: string, state: unknown): Promise<Chat> {
    const now = new Date().toISOString();
    const result = await this.chatsCollection.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      { $set: { state, updatedAt: now } },
      { returnDocument: 'after' },
    );
    if (!result) throw new Error(`Chat ${chatId} not found`);
    return convertChat(result);
  }

  async renameChat(chatId: string, title: string): Promise<Chat> {
    const now = new Date().toISOString();
    const result = await this.chatsCollection.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      { $set: { title, updatedAt: now } },
      { returnDocument: 'after' },
    );
    if (!result) throw new Error(`Chat ${chatId} not found`);
    return convertChat(result);
  }
}
