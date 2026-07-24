import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/navigation", () => ({
  pushState: vi.fn(),
  replaceState: vi.fn(),
}));
vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: vi.fn(),
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: {
    loading: false,
    isAuthenticated: false,
  },
}));

import {
  closeSequenceOverlay,
  getSequenceOverlayState,
  openSequenceOverlay,
} from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";

describe("sequence viewer Play intent", () => {
  const overlay = getSequenceOverlayState();

  beforeEach(() => {
    closeSequenceOverlay();
  });

  it("carries a one-open animation playback request", () => {
    openSequenceOverlay(
      {
        id: "play-intent-sequence",
        name: "Test",
        word: "A",
        steps: [],
      } as never,
      {
        playOnOpen: true,
        fromUrl: true,
        skipHistoryPush: true,
      }
    );

    expect(overlay.isOpen).toBe(true);
    expect(overlay.playOnOpen).toBe(true);
  });

  it("clears the request when the viewer closes", () => {
    openSequenceOverlay(
      {
        id: "play-intent-sequence",
        name: "Test",
        word: "A",
        steps: [],
      } as never,
      {
        playOnOpen: true,
        fromUrl: true,
        skipHistoryPush: true,
      }
    );

    closeSequenceOverlay();

    expect(overlay.playOnOpen).toBe(false);
  });
});
