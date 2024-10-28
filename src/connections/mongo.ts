import { MongoClient, Collection } from 'mongodb';
import dotenv from 'dotenv';
import { Note } from '../services/NotesService.ts';
import { Plan } from '../services/DailyPlansService.ts';
import { Todo } from '../services/TodoService.ts';
import { BuyListItem } from '../services/BuyListService.ts';
import { TalkNote } from '../services/TalkNotesService.ts';
import { ReadingListItem } from '../services/ReadingListService.ts';
import { Creation } from '../services/CreationsService.ts';


dotenv.config();

export type NoId<T> = Omit<T, 'id'>;

const DB_NAME = 'tylernote';

const TODO_COLLECTION_NAME = 'todos';
const BUY_LIST_COLLECTION_NAME = 'buylist';
const TALK_NOTE_COLLECTION_NAME = 'talknotes';
const READING_LIST_COLLECTION_NAME = 'readinglist';
const NOTES_COLLECTION_NAME = 'notes';
const PLAN_COLLECTION_NAME = 'plans';

export class MongoDBService {
  private readonly client: MongoClient;
  private readonly db: string;
  private todoCollection?: Collection<NoId<Todo>>;
  private buyListCollection?: Collection<NoId<BuyListItem>>;
  private talkNoteCollection?: Collection<NoId<TalkNote>>;
  private readingListCollection?: Collection<NoId<ReadingListItem>>;
  private noteCollection?: Collection<NoId<Note>>;
  private planCollection?: Collection<NoId<Plan>>;
  private creationsCollection?: Collection<NoId<Creation>>;

  constructor() {
    const uri = process.env.DB_URI;
    this.db = DB_NAME;

    if (!uri) {
      throw new Error('MONGODB_URI is not defined in the environment variables');
    }

    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log('Connected to MongoDB');
      const database = this.client.db(this.db);
      this.planCollection = database.collection<NoId<Plan>>(PLAN_COLLECTION_NAME);
      this.todoCollection = database.collection<NoId<Todo>>(TODO_COLLECTION_NAME);
      this.buyListCollection = database.collection<NoId<BuyListItem>>(BUY_LIST_COLLECTION_NAME);
      this.talkNoteCollection = database.collection<NoId<TalkNote>>(TALK_NOTE_COLLECTION_NAME);
      this.readingListCollection = database.collection<NoId<ReadingListItem>>(READING_LIST_COLLECTION_NAME);
      this.noteCollection = database.collection<NoId<Note>>(NOTES_COLLECTION_NAME);
      this.creationsCollection = database.collection<NoId<Creation>>('creations');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  getPlanCollection(): Collection<NoId<Plan>> {
    if (!this.planCollection) {
      throw new Error('MongoDB plan collection is not initialized. Did you forget to call connect()?');
    }
    return this.planCollection;
  }

  getTodoCollection(): Collection<NoId<Todo>> {
    if (!this.todoCollection) {
      throw new Error('MongoDB todo collection is not initialized. Did you forget to call connect()?');
    }
    return this.todoCollection;
  }

  getBuyListCollection(): Collection<NoId<BuyListItem>> {
    if (!this.buyListCollection) {
      throw new Error('MongoDB buy list collection is not initialized. Did you forget to call connect()?');
    }
    return this.buyListCollection;
  }

  getTalkNoteCollection(): Collection<NoId<TalkNote>> {
    if (!this.talkNoteCollection) {
      throw new Error('MongoDB talk note collection is not initialized. Did you forget to call connect()?');
    }
    return this.talkNoteCollection;
  }

  getReadingListCollection(): Collection<NoId<ReadingListItem>> {
    if (!this.readingListCollection) {
      throw new Error('MongoDB reading list collection is not initialized. Did you forget to call connect()?');
    }
    return this.readingListCollection;
  }

  getNoteCollection(): Collection<NoId<Note>> {
    if (!this.noteCollection) {
      throw new Error('MongoDB note collection is not initialized. Did you forget to call connect()?');
    }
    return this.noteCollection;
  }

  getCreationsCollection(): Collection<NoId<Creation>> {
    if (!this.creationsCollection) {
      throw new Error('MongoDB creations collection is not initialized. Did you forget to call connect()?');
    }
    return this.creationsCollection;
  }
}

export class DatabaseSingleton {
  private static instance: MongoDBService | null = null;

  private static connectPromise: Promise<MongoDBService> | null = null;

  private constructor() {}

  public static async getInstance(): Promise<MongoDBService> {
    if (DatabaseSingleton.instance) {
      return DatabaseSingleton.instance;
    }

    let connectPromise = DatabaseSingleton.connectPromise;

    if (!connectPromise) {
      connectPromise = new Promise<MongoDBService>(async (resolve, reject) => {
        const instance = new MongoDBService();
        await instance.connect();
        resolve(instance);
      });
      DatabaseSingleton.connectPromise = connectPromise;
    }

    const instance = await connectPromise;
    return instance;
  }
}
