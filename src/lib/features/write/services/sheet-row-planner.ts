/**
 * Sheet row planner.
 *
 * Turns an ordered list of sequences into paginated rows of cells for a choreo
 * sheet. Each sequence becomes a "block" of one or more rows: its steps are laid
 * out left-to-right, `columns` per row, wrapping to additional rows when longer
 * (a 16-count at 8 columns = 2 rows). Short rows are padded with blank cells.
 * Pages hold `rowsPerPage` rows; when `keepBlocksTogether` is set, a block that
 * fits on a page is never split across a page break.
 *
 * Preview and PDF both consume this output, so layout is identical in both.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { ChoreoSheetLayout } from "../domain/types/choreo-sheet";

export interface SheetCell {
  step: StepData | null;
  isBlank: boolean;
}
export interface SheetRow {
  cells: SheetCell[];
  sequenceId: string;
  isBlockStart: boolean;
  isBlockEnd: boolean;
}
export interface SheetPage {
  rows: SheetRow[];
}

function buildBlock(seq: SequenceData, columns: number): SheetRow[] {
  const steps = seq.steps;
  const n = steps.length;
  const rowCount = Math.max(1, Math.ceil(n / columns));
  const rows: SheetRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    const cells: SheetCell[] = [];
    for (let c = 0; c < columns; c++) {
      const idx = r * columns + c;
      if (idx < n) cells.push({ step: steps[idx]!, isBlank: false });
      else cells.push({ step: null, isBlank: true });
    }
    rows.push({
      cells,
      sequenceId: seq.id,
      isBlockStart: r === 0,
      isBlockEnd: r === rowCount - 1,
    });
  }
  return rows;
}

export function planSheet(seqs: readonly SequenceData[], layout: ChoreoSheetLayout): SheetPage[] {
  const { columns, rowsPerPage } = layout;
  const blocks = seqs.map((s) => buildBlock(s, columns)).filter((b) => b.length > 0);

  const pages: SheetPage[] = [];
  let current: SheetRow[] = [];
  const flush = () => {
    if (current.length) {
      pages.push({ rows: current });
      current = [];
    }
  };

  for (const block of blocks) {
    // Keep a block whole when it fits on a page at all and would overflow the current page.
    if (layout.keepBlocksTogether && block.length <= rowsPerPage && current.length + block.length > rowsPerPage) {
      flush();
    }
    for (const row of block) {
      if (current.length === rowsPerPage) flush();
      current.push(row);
    }
  }
  flush();
  return pages;
}
