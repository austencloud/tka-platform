import { describe, expect, it } from "vitest";
import {
  createViewerStudioSurfaces,
  type StudioAnimationFrame,
} from "$lib/shared/sequence-viewer/state/viewer-studio-surfaces.svelte";

describe("shared Studio surfaces", () => {
  const frame = (position: number): StudioAnimationFrame => ({
    sequence: {
      id: "test",
      steps: [],
    } as unknown as StudioAnimationFrame["sequence"],
    position,
    playing: true,
    left: null,
    right: null,
    step: null,
  });

  it("loans one renderer to one slot, then gives it back without losing its registration", () => {
    const state = createViewerStudioSurfaces();
    const canvas = document.createElement("div");
    const unregister = state.registerCanvas(canvas);
    const first = {},
      second = {};
    const a = document.createElement("div"),
      b = document.createElement("div");
    let position = 2.5;
    const release = state.requestCanvas(first, a, () => frame(position));
    state.requestCanvas(second, b, () => frame(7));
    state.enter(2.5, true, 84);
    expect(state.canvasTarget).toBe(a);
    expect(state.ownsCanvas(first)).toBe(true);
    expect(state.ownsCanvas(second)).toBe(false);
    position = 4.25;
    expect(state.frame?.position).toBe(4.25);
    release();
    expect(state.canvasTarget).toBe(b);
    expect(state.frame?.position).toBe(7);
    state.leave();
    expect(state.canvasTarget).toBeNull();
    expect(state.frame).toBeNull();
    expect(state.canvasAvailable).toBe(true);
    unregister();
    expect(state.canvasAvailable).toBe(false);
  });

  it("isolates viewers and ignores stale cleanup from an outgoing owner", () => {
    const state = createViewerStudioSurfaces(),
      other = createViewerStudioSurfaces();
    const old = document.createElement("div"),
      current = document.createElement("div");
    const cleanup = state.registerCanvas(old);
    state.registerCanvas(current);
    cleanup();
    expect(state.canvasAvailable).toBe(true);
    expect(other.canvasAvailable).toBe(false);
    const release = state.requestInspector(old);
    state.requestInspector(current);
    release();
    state.enter(3, false, 100);
    expect(state.inspectorTarget).toBe(current);
    expect(state.entry).toMatchObject({
      position: 3,
      playing: false,
      bpm: 100,
      revision: 1,
    });
    state.leave();
    state.enter(5, true, 120);
    expect(state.entry.revision).toBe(2);
    expect(other.entry.revision).toBe(0);
  });
});
