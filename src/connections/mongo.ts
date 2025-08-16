import { MongoClient, Collection, ServerApiVersion } from 'mongodb';
import { Note } from '../services/notes.ts';
import { Plan } from '../services/DailyPlansService.ts';
import { Todo } from '../services/TodoService.ts';
import { BuyListItem } from '../services/BuyListService.ts';
import { TalkNote } from '../services/TalkNotesService.ts';
import { ReadingListItem } from '../services/ReadingListService.ts';
import { Creation } from '../services/CreationsService.ts';
import { Movie } from '../services/MoviesService.ts';
import { Techie } from '../services/TechieService.ts';
import { WeekendProject } from '../services/WeekendProjectService.ts';
import { TimeBlock } from '../services/TimeTrackerService.ts';
import { Week } from '../services/WeeklyService.ts';
import { List } from '../services/ListsService.ts';
import { Spark } from '../services/SparksService.ts';
import { Jot } from '../services/JotsService.ts';
import { Chat } from '../services/ChatsService.ts';
import { Logger } from 'pino';
import { SessionRecord } from '../services/SessionService.ts';

let dbServiceInstance: MongoDBService | null = null;
let connectPromise: Promise<MongoDBService> | null = null;

export const getDatabase = async (logger: Logger): Promise<MongoDBService> => {
  logger = logger.child({
    module: "getDatabase",
    filename: import.meta.url,
  });

  if (dbServiceInstance) {
    logger.trace('Returning existing instance');
    return dbServiceInstance;
  }

  if (!connectPromise) {
    logger.trace('Creating new instance');
    connectPromise = new Promise<MongoDBService>(async (resolve, reject) => {
      const instance = new MongoDBService(logger);
      try {
        await instance.connect();
        resolve(instance);
      } catch (error) {
        reject(error);
      }
    });
  }

  const instance = await connectPromise;
  logger.trace('Returning new instance');
  return instance;
}


export type NoId<T> = Omit<T, 'id'>;

// Add new GoogleToken type
export interface GoogleToken {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  createdAt: Date;
  updatedAt: Date;
}

const DB_NAME = 'tylernote';

const TODO_COLLECTION_NAME = 'todos';
const BUY_LIST_COLLECTION_NAME = 'buylist';
const TALK_NOTE_COLLECTION_NAME = 'talknotes';
const READING_LIST_COLLECTION_NAME = 'readinglist';
const NOTES_COLLECTION_NAME = 'notes';
const PLAN_COLLECTION_NAME = 'plans';
const TIME_BLOCK_COLLECTION_NAME = 'timeblocks';
const GOOGLE_TOKEN_COLLECTION_NAME = 'googletokens';
const JOTS_COLLECTION_NAME = 'jots';
const CHATS_COLLECTION_NAME = 'chats';
const SESSIONS_COLLECTION_NAME = 'sessions';

export class MongoDBService {
  private readonly client: MongoClient;
  private readonly db: string;
  private readonly logger: Logger;
  private todoCollection?: Collection<NoId<Todo>>;
  private buyListCollection?: Collection<NoId<BuyListItem>>;
  private talkNoteCollection?: Collection<NoId<TalkNote>>;
  private readingListCollection?: Collection<NoId<ReadingListItem>>;
  private noteCollection?: Collection<NoId<Note>>;
  private planCollection?: Collection<NoId<Plan>>;
  private creationsCollection?: Collection<NoId<Creation>>;
  private sparkCollection?: Collection<NoId<Spark>>;
  private moviesCollection?: Collection<NoId<Movie>>;
  private techieCollection?: Collection<NoId<Techie>>;
  private weekendProjectCollection?: Collection<NoId<WeekendProject>>;
  private timeBlockCollection?: Collection<NoId<TimeBlock>>;
  private weekCollection?: Collection<NoId<Week>>;
  private listCollection?: Collection<NoId<List>>;
  private googleTokenCollection?: Collection<NoId<GoogleToken>>;
  private jotsCollection?: Collection<NoId<Jot>>;
  private chatsCollection?: Collection<NoId<Chat>>;
  private sessionsCollection?: Collection<NoId<SessionRecord>>;

  constructor(
    logger: Logger,
  ) {
    this.logger = logger.child({
      module: "MongoDBService",
      filename: import.meta.url,
    });

    const uri = process.env.DB_URI;
    this.db = DB_NAME;

    if (!uri) {
      throw new Error('MONGODB_URI is not defined in the environment variables');
    }

    this.client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        // strict: true,
        deprecationErrors: true,
      }
    });
  }

  async connect(): Promise<void> {
    try {
      this.logger.info("Connecting to Mongodb...")
      const start = Date.now();
      await this.client.connect();
      const duration = Date.now() - start;
      this.logger.info({ duration }, 'Connected to MongoDB');
      const database = this.client.db(this.db);
      this.planCollection = database.collection<NoId<Plan>>(PLAN_COLLECTION_NAME);
      this.todoCollection = database.collection<NoId<Todo>>(TODO_COLLECTION_NAME);
      this.buyListCollection = database.collection<NoId<BuyListItem>>(BUY_LIST_COLLECTION_NAME);
      this.talkNoteCollection = database.collection<NoId<TalkNote>>(TALK_NOTE_COLLECTION_NAME);
      this.readingListCollection = database.collection<NoId<ReadingListItem>>(READING_LIST_COLLECTION_NAME);
      this.noteCollection = database.collection<NoId<Note>>(NOTES_COLLECTION_NAME);
      this.creationsCollection = database.collection<NoId<Creation>>('creations');
      this.sparkCollection = database.collection<NoId<Spark>>('sparks');
      this.moviesCollection = database.collection<NoId<Movie>>('movies');
      this.techieCollection = database.collection<NoId<Techie>>('techies');
      this.weekendProjectCollection = database.collection<NoId<WeekendProject>>('weekendprojects');
      this.timeBlockCollection = database.collection<NoId<TimeBlock>>(TIME_BLOCK_COLLECTION_NAME);
      this.weekCollection = database.collection<NoId<Week>>('weeks');
      this.listCollection = database.collection<NoId<List>>('lists');
      this.googleTokenCollection = database.collection<NoId<GoogleToken>>(GOOGLE_TOKEN_COLLECTION_NAME);
      this.jotsCollection = database.collection<NoId<Jot>>(JOTS_COLLECTION_NAME);
      this.chatsCollection = database.collection<NoId<Chat>>(CHATS_COLLECTION_NAME);
      this.sessionsCollection = database.collection<NoId<SessionRecord>>(SESSIONS_COLLECTION_NAME);
    } catch (error) {
      this.logger.error(error, 'Error connecting to MongoDB');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
    this.logger.info('Disconnected from MongoDB');
    dbServiceInstance = null;
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

  getSparkCollection(): Collection<NoId<Spark>> {
    if (!this.sparkCollection) {
      throw new Error('MongoDB spark collection is not initialized. Did you forget to call connect()?');
    }
    return this.sparkCollection;
  }

  getMoviesCollection(): Collection<NoId<Movie>> {
    if (!this.moviesCollection) {
      throw new Error('MongoDB movies collection is not initialized. Did you forget to call connect()?');
    }
    return this.moviesCollection;
  }

  getTechieCollection(): Collection<NoId<Techie>> {
    if (!this.techieCollection) {
      throw new Error('MongoDB techie collection is not initialized. Did you forget to call connect()?');
    }
    return this.techieCollection;
  }

  getWeekendProjectCollection(): Collection<NoId<WeekendProject>> {
    if (!this.weekendProjectCollection) {
      throw new Error('MongoDB weekend project collection is not initialized. Did you forget to call connect()?');
    }
    return this.weekendProjectCollection;
  }

  getTimeBlockCollection(): Collection<NoId<TimeBlock>> {
    if (!this.timeBlockCollection) {
      throw new Error('MongoDB time block collection is not initialized. Did you forget to call connect()?');
    }
    return this.timeBlockCollection;
  }

  getWeekCollection(): Collection<NoId<Week>> {
    if (!this.weekCollection) {
      throw new Error('MongoDB week collection is not initialized. Did you forget to call connect()?');
    }
    return this.weekCollection;
  }

  getListCollection(): Collection<NoId<List>> {
    if (!this.listCollection) {
      throw new Error('MongoDB list collection is not initialized. Did you forget to call connect()?');
    }
    return this.listCollection;
  }

  // Add getter for Google token collection
  getGoogleTokenCollection(): Collection<NoId<GoogleToken>> {
    if (!this.googleTokenCollection) {
      throw new Error('MongoDB Google token collection is not initialized. Did you forget to call connect()?');
    }
    return this.googleTokenCollection;
  }

  // Add getter for Jots collection
  getJotsCollection(): Collection<NoId<Jot>> {
    if (!this.jotsCollection) {
      throw new Error('MongoDB Jots collection is not initialized. Did you forget to call connect()?');
    }
    return this.jotsCollection;
  }

  getChatsCollection(): Collection<NoId<Chat>> {
    if (!this.chatsCollection) {
      throw new Error('MongoDB Chats collection is not initialized. Did you forget to call connect()?');
    }
    return this.chatsCollection;
  }

  getSessionsCollection(): Collection<NoId<SessionRecord>> {
    if (!this.sessionsCollection) {
      throw new Error('MongoDB Sessions collection is not initialized. Did you forget to call connect()?');
    }
    return this.sessionsCollection;
  }
}
