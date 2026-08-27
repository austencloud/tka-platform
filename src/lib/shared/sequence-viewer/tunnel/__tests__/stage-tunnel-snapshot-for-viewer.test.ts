import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../tunnel-config";
import type { TunnelSnapshot } from "../tunnel-snapshot";
import {
  stageTunnelSnapshotForViewer,
  type TunnelViewerStagingDependencies,
} from "../stage-tunnel-snapshot-for-viewer";
import { EFFECTS_CONFIG_STORAGE_KEY } from "$lib/shared/effects/state/effects-config-state.svelte";

const snapshot = {
  version: 2,
  tunnel: {
    config: { ...DEFAULT_CONFIG, fold: 6 },
    gridVisible: true,
    spectrum: false,
    section: "props",
    presetRecipe: null,
  },
  effects: { activeEffect: "fire", marker: "exact" },
  effort: "punch",
  paths: {
    pathShape: "concave",
    motionAwarePaths: true,
    bluePathLines: true,
    redPathLines: false,
  },
  playback: { bpm: 128, playbackMode: "step" },
  props: {
    bluePropType: "buugeng",
    redPropType: "buugeng",
    blueBuugengFlipped: true,
    redBuugengFlipped: false,
  },
  trailRender: { mode: "trail", marker: "exact" },
} as unknown as TunnelSnapshot;

describe("stageTunnelSnapshotForViewer", () => {
  it("fans every pre-mount field into the viewer's canonical owners", () => {
    const dependencies = {
      visibility: {
        setEffortPreset: vi.fn(),
        setPathPolicy: vi.fn(),
        setVisibility: vi.fn(),
      },
      animationSettings: { updateSettings: vi.fn() },
      settings: { updateSettings: vi.fn() },
      saveViewState: vi.fn(),
      storage: { setItem: vi.fn() },
    } as unknown as TunnelViewerStagingDependencies;

    stageTunnelSnapshotForViewer(snapshot, dependencies);

    expect(dependencies.visibility.setEffortPreset).toHaveBeenCalledWith(
      "punch"
    );
    expect(dependencies.visibility.setPathPolicy).toHaveBeenCalledWith({
      pathShape: "concave",
      motionAwarePaths: true,
    });
    expect(dependencies.visibility.setVisibility).toHaveBeenNthCalledWith(
      1,
      "bluePathLines",
      true
    );
    expect(dependencies.visibility.setVisibility).toHaveBeenNthCalledWith(
      2,
      "redPathLines",
      false
    );
    expect(dependencies.animationSettings.updateSettings).toHaveBeenCalledWith({
      trail: snapshot.trailRender,
    });
    expect(dependencies.settings.updateSettings).toHaveBeenCalledWith(
      snapshot.props
    );
    expect(dependencies.saveViewState).toHaveBeenCalledWith(snapshot.tunnel);
    expect(dependencies.storage?.setItem).toHaveBeenCalledWith(
      EFFECTS_CONFIG_STORAGE_KEY,
      JSON.stringify(snapshot.effects)
    );
  });
});
