import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

function makeState() {
  const result = createViewer3DStateForTest({ renderMode: "3d" });
  cleanups.push(result.dispose);
  return result.state;
}

function handles(renderer: object) {
  return {
    renderer,
    scene: {},
    camera: {},
    runFrame: vi.fn(),
    pauseAutoLoop: vi.fn(),
    resumeAutoLoop: vi.fn(),
  };
}

describe("viewer 3D renderer handles", () => {
  it("clears every export handle when its canvas unregisters", () => {
    const state = makeState();
    const refs = handles({ id: "first" });

    const unregister = state.registerThrelteInternals(refs);
    expect(state.threlteRenderer).toStrictEqual(refs.renderer);
    expect(state.threlteScene).toStrictEqual(refs.scene);
    expect(state.threlteCamera).toStrictEqual(refs.camera);
    expect(state.threlteRunFrame).toBe(refs.runFrame);

    unregister();
    expect(state.threlteRenderer).toBeNull();
    expect(state.threlteScene).toBeNull();
    expect(state.threlteCamera).toBeNull();
    expect(state.threlteRunFrame).toBeNull();
    expect(state.threltePauseAutoLoop).toBeNull();
    expect(state.threlteResumeAutoLoop).toBeNull();
  });

  it("does not let an old canvas clear a newer canvas's handles", () => {
    const state = makeState();
    const first = handles({ id: "first" });
    const second = handles({ id: "second" });

    const unregisterFirst = state.registerThrelteInternals(first);
    const unregisterSecond = state.registerThrelteInternals(second);

    unregisterFirst();
    expect(state.threlteRenderer).toStrictEqual(second.renderer);
    expect(state.threlteRunFrame).toBe(second.runFrame);

    unregisterSecond();
    expect(state.threlteRenderer).toBeNull();
  });
});
