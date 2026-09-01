import { describe, expect, it } from "vitest";

import { createShapeMatrixAnimationState } from "$lib/shared/shape-matrix/app/state/shape-matrix-animation-state.svelte";

describe("Shape Matrix animation state", () => {
  it("starts as an ephemeral, playing 60 BPM trail presentation", () => {
    const state = createShapeMatrixAnimationState();

    expect(state.playing).toBe(true);
    expect(state.bpm).toBe(60);
    expect(state.playbackMode).toBe("continuous");
    expect(state.scope.effects.config.activeEffect).toBe("trails");
    expect(state.scope.effects.trails.trackingMode).toBe("right_end");
  });

  it("keeps playback settings in one workspace owner", () => {
    const state = createShapeMatrixAnimationState();

    state.togglePlaying();
    state.setBpm(84);
    state.setPlaybackMode("step");

    expect(state.playing).toBe(false);
    expect(state.bpm).toBe(84);
    expect(state.scope.visibility.getBpm()).toBe(84);
    expect(state.playbackMode).toBe("step");
  });

  it("closes an open tray before committing disassembly", () => {
    const state = createShapeMatrixAnimationState();

    state.setActiveSection("effects");
    state.requestDisassembled(true);

    expect(state.closeRequest).toBe(1);
    expect(state.disassembled).toBe(false);

    state.setActiveSection(null);

    expect(state.disassembled).toBe(true);
  });

  it("changes disassembly directly when no tray is open", () => {
    const state = createShapeMatrixAnimationState();

    state.requestDisassembled(true);
    expect(state.disassembled).toBe(true);

    state.requestDisassembled(false);
    expect(state.disassembled).toBe(false);
  });
});
