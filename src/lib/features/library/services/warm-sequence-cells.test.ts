import { describe, it, expect, vi, beforeEach } from "vitest";

const renderCell = vi.fn().mockResolvedValue("blob:fake");
vi.mock("$lib/shared/sequence-viewer/services/preview-cell-renderer", () => ({
  renderCell: (...a: unknown[]) => renderCell(...a),
}));
vi.mock("$lib/shared/create/services/sequence-transforms", () => ({
  createStartPositionFromBeatStart: vi.fn().mockReturnValue({ letter: "start" }),
}));
globalThis.URL.revokeObjectURL = vi.fn();

import { warmSequenceCells } from "./warm-sequence-cells";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = {
  id: "s1",
  steps: [{ letter: "A", motions: {} }, { letter: "B", motions: {} }],
  startPosition: { letter: "alpha" },
} as unknown as SequenceData;

describe("warmSequenceCells", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders start + every step at canonical size with upload enabled", async () => {
    await warmSequenceCells(seq, { isDark: true });
    expect(renderCell).toHaveBeenCalledTimes(3); // 1 start + 2 steps
    const o = renderCell.mock.calls[0]![3] as { size: number; probeCloud: boolean; uploadCanonical: boolean; showTKA: boolean };
    expect(o.size).toBe(480);
    expect(o.probeCloud).toBe(true);
    expect(o.uploadCanonical).toBe(true);
    expect(o.showTKA).toBe(true); // from CANONICAL_CARD_VISIBILITY
  });

  it("never throws when a single cell render fails", async () => {
    renderCell.mockRejectedValueOnce(new Error("boom"));
    await expect(warmSequenceCells(seq, { isDark: true })).resolves.toBeUndefined();
  });
});
