import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const studioSource = readFileSync(
  resolve(process.cwd(), "src/routes/test/prop-3d-studio/+page.svelte"),
  "utf8"
);

describe("3D prop studio LOOP seam", () => {
  it("repeats one validated LOOP instead of swapping sequences at its boundary", () => {
    expect(studioSource).toContain("isEffectPreviewLoop(extended)");
    expect(studioSource).toContain("animation.setShouldLoop(true)");

    // A separately generated LOOP can close perfectly and still begin in a
    // different pose from the one before it. Automatically handing it to the
    // clock at the boundary caused the performer snap that kept regressing.
    expect(studioSource).not.toContain("onSequenceBoundary");
    expect(studioSource).not.toContain("preloadNextLoop");
    expect(studioSource).not.toContain("preloadedSequence");
  });
});
