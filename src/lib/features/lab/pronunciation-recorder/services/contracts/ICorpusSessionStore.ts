import type { CoverageCounts } from "../../domain/corpus-plan";

export interface WordEntry {
  file: string;
  word: string;
}

export interface SessionRecord {
  version: 1;
  coverage: CoverageCounts;
  retired: string[];
  wordsRecorded: number;
}

export interface ConnectedSessionFolder {
  name: string;
  directSave: boolean;
}

export interface ICorpusSessionStore {
  supportsDirectSave(): boolean;
  connect(): Promise<ConnectedSessionFolder>;
  /** Writes `<id>.wav`, `<id>.lab`, and rewrites `words.json`. */
  writeWord(id: string, letters: readonly string[], wav: Blob): Promise<void>;
  writeSession(record: SessionRecord): Promise<void>;
  /** Zip fallback only; a no-op when saving directly. */
  finish(): Promise<void>;
}
