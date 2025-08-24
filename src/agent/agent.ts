import { Agent, tool } from '@openai/agents';
import { z } from '@openai/zod/v3';

import { TylersThings } from '../lib.ts';

export const makeAgent = async (tt: TylersThings) => {
  const getNoteTool = tool({
    name: 'get_note',
    description: "Get a note's content by id",
    parameters: z.object({ id: z.string() }).strict(),
    execute: async (input) => {
      const note = await tt.notes.getNoteById(input.id);
      return note;
    },
  });

  const getAllNotesMetadataTool = tool({
    name: 'get_all_notes_metadata',
    description: 'Get all notes metadata',
    parameters: z.object({}),
    execute: async () => {
      const notes = await tt.notes.getAllNotesMetadata();
      return notes;
    },
  });

  const getNotesByIdsTool = tool({
    name: 'get_notes_by_ids',
    description: 'Get notes by ids',
    parameters: z.object({ ids: z.array(z.string()) }).strict(),
    execute: async (input) => {
      const notes = await tt.notes.getNotesByIds(input.ids);
      return notes;
    },
  });

  const updateNoteTagsTool = tool({
    name: 'update_note_tags',
    description: 'Update the tags of a note',
    parameters: z.object({ noteId: z.string(), tags: z.array(z.string()) }).strict(),
    execute: async (input) => {
      const note = await tt.notes.updateNote(input.noteId, { tags: input.tags });
      return note;
    },
    needsApproval: true,
  });

  const agent = new Agent({
    name: "Tyler's Things Agent",
    instructions: 'You are an agent that helps Tyler with his things',
    tools: [getAllNotesMetadataTool, getNoteTool, getNotesByIdsTool, updateNoteTagsTool],
  });

  return agent;
};
