import { DatabaseSingleton } from "../src/connections/mongo.js";
import { ListsService } from "../src/services/ListsService.js";
import type { ListItem } from "../src/services/ListsService.js";

async function main() {
    try {
        const dbService = await DatabaseSingleton.getInstance();
        const listsService = new ListsService(dbService.getListCollection());
        const listId = "67a99810797c2e02f2f5c0da";

        const books = [
            { content: "Meditations by Alexander the Great", checked: false },
            { content: "The Wealth of Nations", checked: false },
            { content: "Paradise Lost", checked: false },
            { content: "Our Mathematical Universe", checked: false },
            { content: "A Clockwork Orange", checked: false },
            { content: "The End is Always near (Dan Carlin)", checked: true },
            { content: "Civilization (Niall Ferguson)", checked: false },
            { content: "Cosmos (Carl Sagan)", checked: false },
            { content: "Blade Runner (Phillip Dick)", checked: true },
            { content: "Annihilation (Jeff VanderMeer)", checked: false },
            { content: "The Vital Question (Nick Lane)", checked: false },
            { content: "The infinite Game (Simon Sinek)", checked: false },
            { content: "The Ascent of Money (Niall Ferguson)", checked: false },
            { content: "No shadow of a Doubt (Daniel Kennefick)", checked: false },
            { content: "How to Take Smart Notes (Sonke Ahrens)", checked: false },
            { content: "The Ride of a lifetime (Robert Iger)", checked: false },
            { content: "critique of reason (Kant)", checked: false },
            { content: "the creative act", checked: false },
            { content: "Godel, echer, bach", checked: false },
            { content: "Getting things done", checked: false },
            { content: "thinking in bets", checked: false },
            { content: "The Party - Goes over the CCP and how it works", checked: false }
        ];

        for (const book of books) {
            console.log(`Adding book: ${book.content} with checked: ${book.checked}`);
            await listsService.addItemToList(listId, book.content);

            if (book.checked) {
                const updatedList = await listsService.getListById(listId);
                if (!updatedList) {
                    console.error(`List with id ${listId} not found after adding item ${book.content}`);
                    continue;
                }
                const newItem = updatedList.items.find((item: ListItem) => item.content === book.content);
                if (!newItem) {
                    console.error(`Failed to locate newly added item: ${book.content}`);
                    continue;
                }
                console.log(`Toggling check for item: ${newItem.id}`);
                await listsService.toggleItemCheck(listId, newItem.id);
            }
        }
        console.log("All books added successfully.");
        await dbService.close();
        process.exit(0);
    } catch (error) {
        console.error("Error adding books: ", error);
        process.exit(1);
    }
}

main();