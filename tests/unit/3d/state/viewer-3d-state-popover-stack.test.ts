import { describe, it, expect } from "vitest";
import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";

function makeDeps() {
  return {
    propInterpolator: { interpolate: () => null } as any,
    sequenceConverter: { convert: () => null } as any,
    viewer3DUndoManager: { push: () => {}, undo: () => {}, redo: () => {} } as any,
  };
}

describe("viewer-3d-state popover stack", () => {
  it("starts with no popover open", () => {
    const s = createViewer3DState(makeDeps());
    expect(s.activePopover).toBeNull();
  });

  it("openPopover sets the active popover", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("performers");
    expect(s.activePopover).toBe("performers");
  });

  it("openPopover replaces the currently-open popover (exclusive)", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("performers");
    s.openPopover("tempo");
    expect(s.activePopover).toBe("tempo");
  });

  it("closePopover clears the active popover", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("export");
    s.closePopover();
    expect(s.activePopover).toBeNull();
  });

  it("openPopover with null is equivalent to closePopover", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("gear");
    s.openPopover(null);
    expect(s.activePopover).toBeNull();
  });
});
