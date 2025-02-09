import { Collection, ObjectId } from 'mongodb';
import { NoId } from '../connections/mongo.ts';
import { NotesService } from './NotesService.ts';

export type WeekTodo = {
    id: string;
    content: string;
    checked: boolean;
    createdAt: string;
    updatedAt: string;
}

export type Week = {
    id: string;
    startDate: string; // ISO string of the week's start (Monday)
    todos: WeekTodo[];
    noteId: string;
    createdAt: string;
    updatedAt: string;
}

export class WeeklyService {
    constructor(
        private readonly weekCollection: Collection<NoId<Week>>,
        private readonly notesService: NotesService
    ) { }

    private getWeekStart(date: Date = new Date()): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    private async createWeeklyNote(date: string): Promise<string> {
        const note = await this.notesService.createNote({
            title: `Week of ${new Date(date).toLocaleDateString()}`,
            content: '',
            date: date,
        });

        await this.notesService.addTag(note.id, 'weekly-note');
        await this.notesService.addTag(note.id, date);

        return note.id;
    }

    async getCurrentWeek(): Promise<Week> {
        const weekStart = this.getWeekStart();
        const weekStartStr = weekStart.toISOString();

        let currentWeek = await this.weekCollection.findOne({
            startDate: weekStartStr
        });

        if (!currentWeek) {
            // Get the most recent week
            const lastWeek = await this.weekCollection
                .find()
                .sort({ startDate: -1 })
                .limit(1)
                .toArray();

            const noteId = await this.createWeeklyNote(weekStartStr);

            // Create new week, copying todos from last week if it exists
            const todos = lastWeek.length > 0
                ? lastWeek[0].todos.map(todo => ({
                    ...todo,
                    checked: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }))
                : [];

            const newWeek: NoId<Week> = {
                startDate: weekStartStr,
                todos,
                noteId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result = await this.weekCollection.insertOne(newWeek);
            currentWeek = { ...newWeek, _id: result.insertedId };
        }

        // if we don't have a note, create one
        if (!currentWeek.noteId) {
            console.log("Creating new weekly note");
            currentWeek.noteId = await this.createWeeklyNote(weekStartStr);
            await this.weekCollection.updateOne(
                { _id: currentWeek._id },
                { $set: { noteId: currentWeek.noteId } }
            );
        }

        return { ...currentWeek, id: currentWeek._id.toString() };
    }

    async addTodo(weekId: string, content: string): Promise<Week> {
        const newTodo: Omit<WeekTodo, 'id'> = {
            content,
            checked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await this.weekCollection.findOneAndUpdate(
            { _id: new ObjectId(weekId) },
            {
                $push: { todos: { ...newTodo, id: new ObjectId().toString() } },
                $set: { updatedAt: new Date().toISOString() }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error(`Week with id ${weekId} not found`);
        }

        return { ...result, id: result._id.toString() };
    }

    async toggleTodo(weekId: string, todoId: string, checked: boolean): Promise<Week> {
        const result = await this.weekCollection.findOneAndUpdate(
            { _id: new ObjectId(weekId), 'todos.id': todoId },
            {
                $set: {
                    'todos.$.checked': checked,
                    'todos.$.updatedAt': new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error(`Week with id ${weekId} or todo with id ${todoId} not found`);
        }

        return { ...result, id: result._id.toString() };
    }

    async updateTodoContent(weekId: string, todoId: string, content: string): Promise<Week> {
        const result = await this.weekCollection.findOneAndUpdate(
            { _id: new ObjectId(weekId), 'todos.id': todoId },
            {
                $set: {
                    'todos.$.content': content,
                    'todos.$.updatedAt': new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error(`Week with id ${weekId} or todo with id ${todoId} not found`);
        }

        return { ...result, id: result._id.toString() };
    }
}