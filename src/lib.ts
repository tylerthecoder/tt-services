import dotenv from 'dotenv';
import { Logger } from 'pino';

import { GoogleService } from './connections/google.ts';
import { getDatabase, MongoDBService } from './connections/mongo.ts';
import { logger as defaultLogger } from './logger.ts';
import { BuyListService } from './services/BuyListService.ts';
import { ChatsService } from './services/ChatsService.ts';
import { CreationsService } from './services/CreationsService.ts';
import { DailyNoteService } from './services/DailyNoteService.ts';
import { DailyPlansService } from './services/DailyPlansService.ts';
import { GoogleNoteService } from './services/GoogleNoteService.ts';
import { GooglePushService } from './services/GooglePushService.ts';
import { JotsService } from './services/JotsService.ts';
import { ListsService } from './services/ListsService.ts';
import { MoviesService } from './services/MoviesService.ts';
import { NotesService } from './services/NotesService.ts';
import { ReadingListService } from './services/ReadingListService.ts';
import { SessionService } from './services/SessionService.ts';
import { SparksService } from './services/SparksService.ts';
import { TalkNotesService } from './services/TalkNotesService.ts';
import { TechieService } from './services/TechieService.ts';
import { TimeTrackerService } from './services/TimeTrackerService.ts';
import { TodoService } from './services/TodoService.ts';
import { WeekendProjectService } from './services/WeekendProjectService.ts';
import { WeeklyService } from './services/WeeklyService.ts';

let instance: TylersThings | null = null;

dotenv.config();

export class TylersThings {
  constructor(
    private readonly logger: Logger,
    private readonly db: MongoDBService,
    public readonly dailyPlans: DailyPlansService,
    public readonly todo: TodoService,
    public readonly buyList: BuyListService,
    public readonly talkNotes: TalkNotesService,
    public readonly readingList: ReadingListService,
    public readonly notes: NotesService,
    public readonly creations: CreationsService,
    public readonly sparks: SparksService,
    public readonly movies: MoviesService,
    public readonly techies: TechieService,
    public readonly weekendProjects: WeekendProjectService,
    public readonly googleNotes: GoogleNoteService,
    public readonly timeTracker: TimeTrackerService,
    public readonly weekly: WeeklyService,
    public readonly lists: ListsService,
    public readonly google: GoogleService,
    public readonly jots: JotsService,
    public readonly dailyNotes: DailyNoteService,
    public readonly chats: ChatsService,
    public readonly sessions: SessionService,
    public readonly googlePush: GooglePushService,
  ) {}

  static async make(
    config: {
      db?: MongoDBService;
      logger?: Logger;
      useInstance?: boolean;
    } = {},
  ): Promise<TylersThings> {
    if (instance && (config.useInstance ?? true)) {
      return instance;
    }
    const logger =
      config.logger ??
      defaultLogger.child({
        module: 'TylersThings',
      });

    const db = config.db ?? (await getDatabase(logger));

    const notes = new NotesService(db.getNoteCollection());
    const dailyPlans = new DailyPlansService(db.getPlanCollection());
    const todo = new TodoService(db.getTodoCollection());
    const buyList = new BuyListService(db.getBuyListCollection());
    const talkNotes = new TalkNotesService(db.getTalkNoteCollection());
    const readingList = new ReadingListService(db.getReadingListCollection());
    const creations = new CreationsService(db.getCreationsCollection());
    const sparks = new SparksService(db.getSparkCollection());
    const movies = new MoviesService(db.getMoviesCollection());
    const techies = new TechieService(notes);
    const google = new GoogleService(db, logger);
    const weekendProjects = new WeekendProjectService(db.getWeekendProjectCollection());
    const googleNotes = new GoogleNoteService(notes, google);
    const timeTracker = new TimeTrackerService(db.getTimeBlockCollection());
    const weekly = new WeeklyService(db.getWeekCollection(), notes);
    const lists = new ListsService(db.getListCollection());
    const jots = new JotsService(db.getJotsCollection());
    const dailyNotes = new DailyNoteService(notes);
    const chats = new ChatsService(db.getChatsCollection());
    const sessions = new SessionService(db.getSessionsCollection());
    const googlePush = new GooglePushService(google, notes, googleNotes, logger);

    instance = new TylersThings(
      logger,
      db,
      dailyPlans,
      todo,
      buyList,
      talkNotes,
      readingList,
      notes,
      creations,
      sparks,
      movies,
      techies,
      weekendProjects,
      googleNotes,
      timeTracker,
      weekly,
      lists,
      google,
      jots,
      dailyNotes,
      chats,
      sessions,
      googlePush,
    );

    return instance;
  }

  async disconnect() {
    this.logger.info('Disconnecting from database');
    await this.db.close();
  }
}
