import { DatabaseSingleton } from "../src/connections/mongo.ts";
import { ListsService } from "../src/services/ListsService.ts";
import type { ListItem } from "../src/services/ListsService.ts";

async function main() {
    try {
        const dbService = await DatabaseSingleton.getInstance();
        const listsService = new ListsService(dbService.getListCollection());
        const listId = "67a9987b669bb34240200943";

        const movies = [
            { content: "Taxi Driver", checked: false },
            { content: "inception", checked: true },
            { content: "Blade Runner 2049", checked: false },
            { content: "Equilibrium", checked: false },
            { content: "Spongebob out of water", checked: false },
            { content: "Dude wheres my car", checked: false },
            { content: "Moneyball", checked: false },
            { content: "Office Space", checked: true },
            { content: "The Big Lebowski", checked: false },
            { content: "The hitchhikers Guide to the Galaxy", checked: false },
            { content: "The Stoned Age", checked: false },
            { content: "Ise of Dogs", checked: true },
            { content: "Free Guy", checked: true },
            { content: "Tenet", checked: false },
            { content: "Mad max", checked: false },
            { content: "Everything Everywhere all at once", checked: true },
            { content: "Morbious", checked: false },
            { content: "Watchmen", checked: false },
            { content: "Good will hunting", checked: true },
            { content: "Black Adam", checked: true },
            { content: "a place beyond the pines", checked: false }
        ];

        for (const movie of movies) {
            console.log(`Adding movie: ${movie.content} with checked: ${movie.checked}`);
            await listsService.addItemToList(listId, movie.content);

            if (movie.checked) {
                const updatedList = await listsService.getListById(listId);
                if (!updatedList) {
                    console.error(`List with id ${listId} not found after adding item ${movie.content}`);
                    continue;
                }
                const newItem = updatedList.items.find((item: ListItem) => item.content === movie.content);
                if (!newItem) {
                    console.error(`Failed to locate newly added item: ${movie.content}`);
                    continue;
                }
                console.log(`Toggling check for movie item: ${newItem.id}`);
                await listsService.toggleItemCheck(listId, newItem.id);
            }
        }
        console.log("All movies added successfully.");
        await dbService.close();
        process.exit(0);
    } catch (error) {
        console.error("Error adding movies: ", error);
        process.exit(1);
    }
}

main();