/**
 * Choreo Sheet domain types.
 *
 * A ChoreoSheet is a printable landscape roster: an ordered set of sequences,
 * each laid out as a row of its step-pictographs (8 cells across, 6 rows per
 * US-Letter landscape page, long sequences wrapping to rows of 8). It is a
 * lightweight sibling of the Act (which is a music/timing performance playlist) —
 * a sheet stores only sequence references + layout settings; steps are hydrated
 * from the library at render time.
 */

export type PaperSize = "letter"; // 'a4' is a future variant
export type SheetOrientation = "landscape" | "portrait";
export type SheetPacking = "flow" | "aligned";
export type GroupSeparator = "rule" | "gap" | "none";

/** Stable per-band anchor: which sequence, and which of its wrapped rows. */
export type BandKey = string;
export function bandKey(sequenceId: string, rowInSequence: number): BandKey {
  return `${sequenceId}:${rowInSequence}`;
}

export interface CueMark {
  band: BandKey;
  timestamp: string; // "0:42" — user-editable, BPM-prefilled
  text: string; // lyric / musical cue
}

export interface NoteMark {
  id: string; // stable id for edit/remove
  band: BandKey;
  count: number | null; // 1..columns to pin under a column; null = full-width bullet
  text: string;
}

export interface SheetHeader {
  songName?: string;
  choreographer?: string;
  songArtist?: string;
  tagline?: string;
  date?: string;
  showTitleBlock: boolean;
}

export interface ChoreoSheetAnnotations {
  cues: CueMark[];
  notes: NoteMark[];
  header: SheetHeader;
}

export function createEmptyAnnotations(): ChoreoSheetAnnotations {
  return { cues: [], notes: [], header: { showTitleBlock: true } };
}

export interface ChoreoSheetLayout {
  columns: number; // cells per row (default 8)
  rowsPerPage: number; // rows per printed page (default 6)
  paperSize: PaperSize;
  showStepNumbers: boolean;
  groupSeparator: GroupSeparator;
  keepBlocksTogether: boolean; // never split one sequence's rows across a page break
  orientation: SheetOrientation;
  packing: SheetPacking;
  showCueRail: boolean;
  showNoteStrips: boolean;
}

export const DEFAULT_SHEET_LAYOUT: ChoreoSheetLayout = {
  columns: 8,
  rowsPerPage: 6,
  paperSize: "letter",
  showStepNumbers: true,
  groupSeparator: "rule",
  keepBlocksTogether: true,
  orientation: "landscape",
  packing: "flow",
  showCueRail: false,
  showNoteStrips: false,
};

export interface ChoreoSheet {
  id: string;
  name: string;
  ownerId: string;
  sequenceIds: readonly string[]; // ordered; one block per sequence
  layout: ChoreoSheetLayout;
  annotations: ChoreoSheetAnnotations;
  bpm?: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createEmptyChoreoSheet(ownerId: string, name = "Untitled Sheet"): ChoreoSheet {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name,
    ownerId,
    sequenceIds: [],
    layout: { ...DEFAULT_SHEET_LAYOUT },
    annotations: createEmptyAnnotations(),
    createdAt: now,
    updatedAt: now,
  };
}
