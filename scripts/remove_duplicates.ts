import { DatabaseSingleton } from "../src/connections/mongo.ts";
import { ListsService } from "../src/services/ListsService.ts";
import type { List, ListItem } from "../src/services/ListsService.ts";
import { ObjectId } from "mongodb";

async function removeDuplicatesFromList(listsService: ListsService, list: List) {
    // Create a map to track unique items by content
    const uniqueItems = new Map<string, ListItem>();
    const duplicates: ListItem[] = [];

    // Identify duplicates while keeping the most recently updated version
    for (const item of list.items) {
        const existing = uniqueItems.get(item.content.toLowerCase());
        if (existing) {
            // Keep the most recently updated version
            if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
                duplicates.push(existing);
                uniqueItems.set(item.content.toLowerCase(), item);
            } else {
                duplicates.push(item);
            }
        } else {
            uniqueItems.set(item.content.toLowerCase(), item);
        }
    }

    // If there are duplicates, update the list with only unique items
    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicates in list "${list.name}" (${list.id})`);
        console.log("Duplicate items:", duplicates.map(d => d.content));

        // Update the list with only unique items
        const uniqueItemsArray = Array.from(uniqueItems.values());
        const result = await listsService["listCollection"].findOneAndUpdate(
            { _id: new ObjectId(list.id) },
            {
                $set: {
                    items: uniqueItemsArray,
                    updatedAt: new Date().toISOString()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error(`Failed to update list ${list.id}`);
        }
        console.log(`Updated list "${list.name}" - removed ${duplicates.length} duplicates`);
    }
}

async function main() {
    try {
        const dbService = await DatabaseSingleton.getInstance();
        const listsService = new ListsService(dbService.getListCollection());

        // Get all lists
        const lists = await listsService.getAllLists();
        console.log(`Processing ${lists.length} lists for duplicates...`);

        // Process each list
        for (const list of lists) {
            await removeDuplicatesFromList(listsService, list);
        }

        console.log("Finished processing all lists.");
        await dbService.close();
        process.exit(0);
    } catch (error) {
        console.error("Error removing duplicates:", error);
        process.exit(1);
    }
}

main();
