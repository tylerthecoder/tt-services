import fs from 'fs';
import { DatabaseSingleton } from "../src/connections/mongo.ts";
import { TylersThings } from "../src/lib.ts";

async function main() {
    const [userId, documentId, outputPath] = process.argv.slice(2);

    if (!userId || !documentId) {
        console.error("Usage: bun run scripts/download_google_doc_json.ts <userId/email> <documentId> [output.json]");
        process.exit(1);
    }

    try {
        const dbService = await DatabaseSingleton.getInstance();
        const services = await TylersThings.make(dbService);

        console.log(`Fetching Google Doc JSON for user: ${userId}, document: ${documentId} ...`);
        const docJson = await services.google.getGoogleDoc(userId, documentId);

        const jsonString = JSON.stringify(docJson, null, 2);

        if (outputPath) {
            await fs.promises.writeFile(outputPath, jsonString, 'utf-8');
            console.log(`Saved JSON to ${outputPath}`);
        } else {
            console.log(jsonString);
        }
    } catch (error) {
        console.error('Error fetching Google Doc JSON:', error);
        process.exit(1);
    }
}

await main();