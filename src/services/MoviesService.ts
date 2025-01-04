import { Collection, ObjectId } from 'mongodb';
import { NoId } from '../connections/mongo.ts';

export type Movie = {
    id: string;
    title: string;
    notes: string;
    watched: boolean;
    rating?: number;
    genre?: string;
    releaseYear?: number;
    createdAt: string;
    updatedAt: string;
    watchedAt?: string;
}

export class MoviesService {
    constructor(private readonly moviesCollection: Collection<NoId<Movie>>) {}

    async getAllMovies(): Promise<Movie[]> {
        const results = await this.moviesCollection.find().sort({ createdAt: -1 }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async getMovieById(id: string): Promise<Movie | null> {
        const result = await this.moviesCollection.findOne({ _id: new ObjectId(id) });
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async createMovie(movie: Pick<Movie, 'title' | 'notes' | 'genre' | 'releaseYear'>): Promise<Movie> {
        const newMovie: NoId<Movie> = {
            ...movie,
            watched: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const result = await this.moviesCollection.insertOne(newMovie);
        return { ...newMovie, id: result.insertedId.toString() };
    }

    async updateMovie(id: string, update: Partial<Omit<Movie, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Movie | null> {
        const updateDoc: any = {
            $set: {
                ...update,
                updatedAt: new Date().toISOString(),
            },
        };

        // If marking as watched, set watchedAt
        if (update.watched) {
            updateDoc.$set.watchedAt = new Date().toISOString();
        }

        const result = await this.moviesCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        return result ? { ...result, id: result._id.toString() } : null;
    }

    async deleteMovie(id: string): Promise<boolean> {
        const result = await this.moviesCollection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount === 1;
    }

    async getWatchedMovies(): Promise<Movie[]> {
        const results = await this.moviesCollection.find({ watched: true }).sort({ watchedAt: -1 }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }

    async getUnwatchedMovies(): Promise<Movie[]> {
        const results = await this.moviesCollection.find({ watched: false }).sort({ createdAt: -1 }).toArray();
        return results.map(result => ({ ...result, id: result._id.toString() }));
    }
}