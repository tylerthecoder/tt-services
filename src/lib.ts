import { DailyPlansService } from "./services/DailyPlansService.ts";
import { TodoService } from "./services/TodoService.ts";
import { BuyListService } from "./services/BuyListService.ts";
import { TalkNotesService } from "./services/TalkNotesService.ts";
import { ReadingListService } from "./services/ReadingListService.ts";
import { NotesService } from "./services/NotesService.ts";
import { DatabaseSingleton } from "./connections/mongo.ts";
import { CreationsService } from "./services/CreationsService.ts";

export class TylersThings {
    constructor(
        public readonly dailyPlans: DailyPlansService,
        public readonly todo: TodoService,
        public readonly buyList: BuyListService,
        public readonly talkNotes: TalkNotesService,
        public readonly readingList: ReadingListService,
        public readonly notes: NotesService,
        public readonly creations: CreationsService
    ) {}

    static async make(): Promise<TylersThings> {

        const db = await DatabaseSingleton.getInstance();

        const dailyPlans = new DailyPlansService(db.getPlanCollection());
        const todo = new TodoService(db.getTodoCollection());
        const buyList = new BuyListService(db.getBuyListCollection());
        const talkNotes = new TalkNotesService(db.getTalkNoteCollection());
        const readingList = new ReadingListService(db.getReadingListCollection());
        const notes = new NotesService(db.getNoteCollection());
        const creations = new CreationsService(db.getCreationsCollection());

        return new TylersThings(
            dailyPlans,
            todo,
            buyList,
            talkNotes,
            readingList,
            notes,
            creations
        );
    }
}
