export type {
  DailyNote,
  DailyNoteMetadata,
  GoogleNote,
  GoogleNoteMetadata,
  Note,
  NoteMetadata,
} from './notes/notes.ts';
export {
  isDailyNote,
  isDailyNoteMetadata,
  isGoogleNote,
  isGoogleNoteMetadata,
} from './notes/notes.ts';
export type { PushToGoogleResult } from './services/GooglePushService.ts';
