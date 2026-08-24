import { describe, expect, it, vi } from "vitest";

import { createAvatarPlaybackAdapter } from "./avatar-playback-adapter.svelte";

describe("createAvatarPlaybackAdapter", () => {
  it("keeps transport available while the avatar sequence is hydrating", () => {
    const seek = vi.fn();
    const toggle = vi.fn();
    const adapter = createAvatarPlaybackAdapter(
      () => ({
        progress: 0,
        currentStepIndex: 0,
        totalSteps: 0,
        isPlaying: false,
        speed: 1,
        loop: true,
        togglePlay: vi.fn(),
        setProgress: vi.fn(),
        goToStep: vi.fn(),
      }),
      {
        onPlaybackToggle: toggle,
        onProgressBarSeek: seek,
        getIsPlaying: () => false,
        getCurrentStep: () => 1.5,
        getTotalSteps: () => 8,
      }
    );

    expect(adapter.totalSteps).toBe(8);
    expect(adapter.currentStep).toBe(2);
    expect(adapter.overallProgress).toBe(1.5 / 8);
    expect(adapter.beatMarkerPositions).toHaveLength(7);

    adapter.seek(0.5);
    expect(seek).toHaveBeenCalledWith(4);

    adapter.togglePlay();
    expect(toggle).toHaveBeenCalledOnce();
  });
});
