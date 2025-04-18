import { DatabaseSingleton } from "../src/connections/mongo.ts";
import { TylersThings } from "../src/lib.ts";
import { GoogleNoteService } from "../src/services/GoogleNoteService.ts";


async function main() {
    try {
        const dbService = await DatabaseSingleton.getInstance();
        const services = await TylersThings.make(dbService);

        console.log('Saving content from Google Doc...');

        await services.googleNotes.saveContentFromGoogleDoc('67fc57c2cc38b26e74fe6c1a', 'tylertracy1999@gmail.com');
    } catch (error) {
        console.error('Error:', error);
    }
}

await main();