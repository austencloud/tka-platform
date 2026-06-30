import { describe, it, expect } from "vitest";
import { planSheet } from "$lib/features/write/services/sheet-row-planner";
import { DEFAULT_SHEET_LAYOUT } from "$lib/features/write/domain/types/choreo-sheet";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

// minimal StepData stub — the planner only reads identity/length, not pictograph fields
function step(n: number): StepData {
  return { stepNumber: n, duration: 1, blueReversal: false, redReversal: false, isBlank: false } as StepData;
}
function seq(id: string, count: number): SequenceData {
  return { id, steps: Array.from({ length: count }, (_, i) => step(i + 1)) } as unknown as SequenceData;
}

const layout = DEFAULT_SHEET_LAYOUT; // 8 cols, 6 rows/page

describe("planSheet", () => {
  it("an 8-count is one full row, no blanks, single block", () => {
    const pages = planSheet([seq("a", 8)], layout);
    expect(pages).toHaveLength(1);
    expect(pages[0].rows).toHaveLength(1);
    const row = pages[0].rows[0];
    expect(row.cells).toHaveLength(8);
    expect(row.cells.every((c) => !c.isBlank)).toBe(true);
    expect(row.isBlockStart && row.isBlockEnd).toBe(true);
  });

  it("a 5-count pads the row to 8 with blank cells", () => {
    const row = planSheet([seq("a", 5)], layout)[0].rows[0];
    expect(row.cells.filter((c) => !c.isBlank)).toHaveLength(5);
    expect(row.cells.filter((c) => c.isBlank)).toHaveLength(3);
  });

  it("a 16-count wraps to two rows tagged as one block", () => {
    const rows = planSheet([seq("a", 16)], layout)[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].isBlockStart).toBe(true);
    expect(rows[0].isBlockEnd).toBe(false);
    expect(rows[1].isBlockStart).toBe(false);
    expect(rows[1].isBlockEnd).toBe(true);
  });

  it("paginates at 6 rows per page", () => {
    const pages = planSheet(Array.from({ length: 7 }, (_, i) => seq(`s${i}`, 8)), layout);
    expect(pages).toHaveLength(2);
    expect(pages[0].rows).toHaveLength(6);
    expect(pages[1].rows).toHaveLength(1);
  });

  it("keeps a block together: a 16-count after five 8-counts moves to the next page", () => {
    const seqs = [...Array.from({ length: 5 }, (_, i) => seq(`e${i}`, 8)), seq("big", 16)];
    const pages = planSheet(seqs, layout);
    expect(pages).toHaveLength(2);
    expect(pages[0].rows).toHaveLength(5); // five 8-counts
    expect(pages[1].rows).toHaveLength(2); // the 16-count block, kept whole
  });
});
