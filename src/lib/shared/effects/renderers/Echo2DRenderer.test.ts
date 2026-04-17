import { describe, it, expect } from "vitest";
import { Echo2DRenderer } from "./Echo2DRenderer";

describe("Echo2DRenderer (skeleton)", () => {
  it("dispose() empties phantom state", () => {
    const r = new Echo2DRenderer();
    // Skeleton: nothing captured yet. Real tests land in Task 4.
    r.dispose();
    expect((r as any).phantomsBlue.length).toBe(0);
    expect((r as any).phantomsRed.length).toBe(0);
  });
});
