
export type Note<ExtraFields = {}> = {
  id: string;
  title: string;
  content: string;
  date: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  deleted?: boolean;
} & ExtraFields

export type GoogleNote = Note<{ googleDocId: string }>;

export const GOOGLE_NOTE_TAG = 'google-doc';

export const isGoogleNote = (note: Note): note is GoogleNote => {
    const hasGoogleTag = note.tags?.includes(GOOGLE_NOTE_TAG) ?? false;
    const hasGoogleDocId = 'googleDocId' in note;
    console.log("hasGoogleTag", hasGoogleTag, hasGoogleDocId, note.content);
    return hasGoogleTag && hasGoogleDocId;
}