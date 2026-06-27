import { describe, it, expect } from "vitest";
import { createCrossfaderState } from "../crossfader-state.svelte";

/**
 * Regression coverage for the "light theme selected, step cells render dark"
 * bug. Neither contentKey nor imageKey encode dark mode, so a darkMode flip
 * that lands in the same reactive flush as a layout change (the export panel
 * opening swaps darkMode + columnCount together) was classified "layout-only".
 * That path only repositions cells — it never re-renders the baked PNGs — so
 * the DOM theme flipped to light while the step images stayed dark-baked.
 *
 * classifyChange must NOT return "layout-only" when darkMode also changed.
 */
describe("crossfader classifyChange — darkMode + layout coincidence", () => {
  function seeded() {
    const c = createCrossfaderState(() => false);
    c.updateKeys({ contentKey: "C0", imageKey: "I0", gridStableKey: "G0" });
    return c;
  }

  it("classifies a pure layout change (no darkMode flip) as layout-only", () => {
    const c = seeded();
    const result = c.classifyChange(
      "C1", // content changed (columnCount)
      "I0", // image identical
      "G1", // grid structure changed
      /* cellsLoaded */ true,
      /* hasDurations */ false,
      /* darkModeChanged */ false,
    );
    expect(result).toBe("layout-only");
  });

  it("escalates to full re-render when darkMode flips alongside the layout change", () => {
    const c = seeded();
    const result = c.classifyChange(
      "C1", // content changed (columnCount)
      "I0", // image key identical — darkMode is NOT encoded here
      "G1", // grid structure changed
      /* cellsLoaded */ true,
      /* hasDurations */ false,
      /* darkModeChanged */ true,
    );
    // Must NOT be layout-only: that path skips the PNG re-render and strands
    // dark-baked images under a light DOM.
    expect(result).not.toBe("layout-only");
    expect(result).toBe("full");
  });

  it("classifies a pure darkMode change as dark-mode-only (smooth crossfade)", () => {
    const c = seeded();
    const result = c.classifyChange(
      "C0", // content identical
      "I0", // image identical
      "G0", // grid identical
      /* cellsLoaded */ true,
      /* hasDurations */ false,
      /* darkModeChanged */ true,
    );
    expect(result).toBe("dark-mode-only");
  });

  it("classifies an image-only change with stable grid as grid-stable-image", () => {
    const c = seeded();
    const result = c.classifyChange(
      "C1", // content changed (image key feeds content key upstream)
      "I1", // image changed (e.g. prop type)
      "G0", // grid structure unchanged
      /* cellsLoaded */ true,
      /* hasDurations */ false,
      /* darkModeChanged */ false,
    );
    expect(result).toBe("grid-stable-image");
  });
});
