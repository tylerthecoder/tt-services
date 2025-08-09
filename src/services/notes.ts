
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

export type NoteMetadata<ExtraFields = {}> = Omit<Note<ExtraFields>, 'content'>;

export type GoogleNote = Note<{
  googleDocId: string,
  googleDocContent: string // This is a staging area for the Google Doc content so we can handle merges
}>;
export type GoogleNoteMetadata = NoteMetadata<{
  googleDocId: string,
}>;

export const GOOGLE_NOTE_TAG = 'google-doc';

export const isGoogleNote = (note: Note): note is GoogleNote => {
  const hasGoogleTag = note.tags?.includes(GOOGLE_NOTE_TAG) ?? false;
  const hasGoogleDocId = 'googleDocId' in note;
  return hasGoogleTag && hasGoogleDocId;
}

export const isGoogleNoteMetadata = (note: NoteMetadata): note is GoogleNoteMetadata => {
  const hasGoogleTag = note.tags?.includes(GOOGLE_NOTE_TAG) ?? false;
  const hasGoogleDocId = 'googleDocId' in note;
  return hasGoogleTag && hasGoogleDocId;
}