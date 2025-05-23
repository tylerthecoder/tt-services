import { DailyPlansService } from "./services/DailyPlansService.ts";
import { TodoService } from "./services/TodoService.ts";
import { BuyListService } from "./services/BuyListService.ts";
import { TalkNotesService } from "./services/TalkNotesService.ts";
import { ReadingListService } from "./services/ReadingListService.ts";
import { NotesService } from "./services/NotesService.ts";
import { MongoDBService } from "./connections/mongo.ts";
import { CreationsService } from "./services/CreationsService.ts";
import { SparksService } from "./services/SparksService.ts";
import { MoviesService } from "./services/MoviesService.ts";
import { TechieService } from "./services/TechieService.ts";
import { WeekendProjectService } from "./services/WeekendProjectService.ts";
import { GoogleNoteService } from "./services/GoogleNoteService.ts";
import { TimeTrackerService } from "./services/TimeTrackerService.ts";
import { WeeklyService } from "./services/WeeklyService.ts";
import { ListsService } from './services/ListsService.ts';
import { GoogleService } from './connections/google.ts';
import { JotsService } from './services/JotsService.ts';
import { DailyNoteService } from './services/DailyNoteService.ts';

export class TylersThings {
    constructor(
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
        public readonly dailyNotes: DailyNoteService
    ) { }

    static async make(
        db: MongoDBService
    ): Promise<TylersThings> {
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
        const google = new GoogleService(db);
        const weekendProjects = new WeekendProjectService(db.getWeekendProjectCollection());
        const googleNotes = new GoogleNoteService(notes, google);
        const timeTracker = new TimeTrackerService(db.getTimeBlockCollection());
        const weekly = new WeeklyService(db.getWeekCollection(), notes);
        const lists = new ListsService(db.getListCollection());
        const jots = new JotsService(db.getJotsCollection());
        const dailyNotes = new DailyNoteService(notes);

        return new TylersThings(
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
            dailyNotes
        );
    }
}
