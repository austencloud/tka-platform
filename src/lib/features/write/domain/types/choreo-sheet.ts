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
export type SheetOrientation = "landscape"; // fixed for v1
export type GroupSeparator = "rule" | "gap" | "none";

export interface ChoreoSheetLayout {
  columns: number; // cells per row (default 8)
  rowsPerPage: number; // rows per printed page (default 6)
  paperSize: PaperSize;
  orientation: SheetOrientation;
  showStepNumbers: boolean;
  groupSeparator: GroupSeparator;
  keepBlocksTogether: boolean; // never split one sequence's rows across a page break
}

export const DEFAULT_SHEET_LAYOUT: ChoreoSheetLayout = {
  columns: 8,
  rowsPerPage: 6,
  paperSize: "letter",
  orientation: "landscape",
  showStepNumbers: true,
  groupSeparator: "rule",
  keepBlocksTogether: true,
};

export interface ChoreoSheet {
  id: string;
  name: string;
  ownerId: string;
  sequenceIds: readonly string[]; // ordered; one block per sequence
  layout: ChoreoSheetLayout;
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
    createdAt: now,
    updatedAt: now,
  };
}
