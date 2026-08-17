import type { CoverageCounts } from "../../domain/corpus-plan";

export interface WordEntry {
  file: string;
  word: string;
  /**
   * The letters as recorded, kept alongside the joined `word` because joining
   * loses the split. "Σ-α" is two letters, but so is "Σ" followed by something
   * beginning with a dash, and the cutter has to pair each letter with one
   * aligned span — a mis-split shifts every boundary in the word by one and
   * files each token under the wrong letter. `cut_tokens.py` refuses to run
   * without this array rather than tokenizing the string and hoping.
   */
  letters: string[];
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
