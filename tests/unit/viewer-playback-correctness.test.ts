import { describe, expect, it, vi } from "vitest";
import { sceneLoadingPlaybackTransition } from "$lib/shared/3d/domain/scene-loading-playback";
import { toggleTunnelPlayback } from "$lib/shared/sequence-viewer/domain/tunnel-playback";

describe("viewer playback correctness", () => {
  it("uses the same tunnel state and callback for canvas and sidebar toggles", () => {
    const report = vi.fn();
    let playing = true;

    playing = toggleTunnelPlayback(playing, "canvas", report);
    expect(playing).toBe(false);
    playing = toggleTunnelPlayback(playing, "sidebar", report);
    expect(playing).toBe(true);
    expect(report.mock.calls).toEqual([
      [true, false, "canvas"],
      [false, true, "sidebar"],
    ]);
  });

  it("requests one system pause and one system resume around the 3D curtain", () => {
    let state = sceneLoadingPlaybackTransition({
      sceneReady: false,
      isPlaying: true,
      held: false,
    });
    expect(state).toEqual({ held: true, syncTo: false });

    state = sceneLoadingPlaybackTransition({
      sceneReady: false,
      isPlaying: false,
      held: state.held,
    });
    expect(state).toEqual({ held: true, syncTo: null });

    state = sceneLoadingPlaybackTransition({
      sceneReady: true,
      isPlaying: false,
      held: state.held,
    });
    expect(state).toEqual({ held: false, syncTo: true });

    expect(
      sceneLoadingPlaybackTransition({
        sceneReady: true,
        isPlaying: true,
        held: state.held,
      })
    ).toEqual({ held: false, syncTo: null });
  });
});
