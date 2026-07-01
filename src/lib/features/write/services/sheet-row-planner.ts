/**
 * Sheet row planner.
 *
 * Lays an ordered list of sequences out as one CONTINUOUS flow of cells for a
 * choreo sheet: every step of every sequence is placed left-to-right, `columns`
 * per row, wrapping straight into the next row — the next sequence begins in the
 * very next cell, not on a fresh row. A 12-count then an 8-count at 8 columns
 * fills row 1 (8), row 2 cells 1-4 (seq 1 tail) + cells 5-8 (seq 2 head), etc.
 * Only the final row is padded with blank cells to square off the grid.
 *
 * Each cell carries its `sequenceId` and whether it's the first cell of its
 * sequence (`isSequenceStart`) — a sequence's run can begin mid-row, so
 * selection highlighting and break/separator marks are per-cell, not per-row.
 *
 * Preview and PDF both consume this output, so layout is identical in both.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { ChoreoSheetLayout } from "../domain/types/choreo-sheet";

export interface SheetCell {
  step: StepData | null;
  isBlank: boolean;
  /** Owning sequence id, or null for a trailing blank pad cell. */
  sequenceId: string | null;
  /** True for the first cell of a sequence's run in the flow. */
  isSequenceStart: boolean;
}
export interface SheetRow {
  cells: SheetCell[];
}
export interface SheetPage {
  rows: SheetRow[];
}

export function planSheet(
  seqs: readonly SequenceData[],
  layout: ChoreoSheetLayout
): SheetPage[] {
  const { columns, rowsPerPage } = layout;

  // 1. Flatten every sequence's steps into one continuous cell stream.
  const cells: SheetCell[] = [];
  for (const seq of seqs) {
    seq.steps.forEach((step, i) => {
      cells.push({
        step,
        isBlank: false,
        sequenceId: seq.id,
        isSequenceStart: i === 0,
      });
    });
  }

  if (cells.length === 0) return [];

  // 2. Pad only the final row up to a full width, so the grid squares off.
  const remainder = cells.length % columns;
  if (remainder !== 0) {
    for (let i = remainder; i < columns; i++) {
      cells.push({ step: null, isBlank: true, sequenceId: null, isSequenceStart: false });
    }
  }

  // 3. Chunk into rows of `columns`, paginate every `rowsPerPage` rows.
  const pages: SheetPage[] = [];
  let rows: SheetRow[] = [];
  for (let i = 0; i < cells.length; i += columns) {
    rows.push({ cells: cells.slice(i, i + columns) });
    if (rows.length === rowsPerPage) {
      pages.push({ rows });
      rows = [];
    }
  }
  if (rows.length) pages.push({ rows });
  return pages;
}
