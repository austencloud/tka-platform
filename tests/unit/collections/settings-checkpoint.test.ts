import { describe, it, expect, beforeEach, vi } from "vitest";

// settingsService.updateSettings() calls applyThemeForBackground() whenever
// backgroundType is included in the payload (which our revert path always
// does). That function guards on `import.meta.hot` but not
// `import.meta.hot.data`, and under Vitest's transform `import.meta.hot` is
// truthy with `data` undefined — an unrelated pre-existing gap in that HMR
// guard, not something this suite is testing. Stub it out so the checkpoint
// tests exercise the real settingsState write without tripping over it.
vi.mock("$lib/shared/settings/utils/background-theme-calculator", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("$lib/shared/settings/utils/background-theme-calculator")>();
  return { ...actual, applyThemeForBackground: () => {} };
});

import {
  captureSettingsCheckpoint,
  revertSettingsCheckpoint,
} from "$lib/shared/collections/settings-checkpoint.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import {
  animationSettings,
  TrailMode,
} from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { EFFECTS_CONFIG_STORAGE_KEY } from "$lib/shared/effects/state/effects-config-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { BackgroundType } from "@austencloud/backgrounds";

// These raw key literals mirror the ones open-tunnel-in-viewer.ts /
// open-3d-scene.ts write directly — the whole point of this suite is
// checking the checkpoint restores exactly what those apply paths touch, so
// the keys have to match theirs byte-for-byte, not settings-checkpoint's own
// (private) constants.
const TUNNEL_VIEW_STATE_KEY = "tka_tunnel_view_state";
const VIEWER_MODE_KEY = "tka-viewer-mode";
const SCENE_FEATURES_KEY = "tka-scene-features";

describe("settings checkpoint capture/revert symmetry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores raw keys that existed before capture and deletes keys the apply path created", () => {
    // Pristine state: some keys already have a value, others don't exist yet
    // (matches a viewer that's never touched 3D — no tka-viewer3d-* keys, no
    // scene-features key).
    localStorage.setItem(TUNNEL_VIEW_STATE_KEY, "pristine-tunnel-state");
    localStorage.setItem(EFFECTS_CONFIG_STORAGE_KEY, "pristine-effects");
    localStorage.setItem(VIEWER_MODE_KEY, "split");
    localStorage.setItem("tka-viewer3d-renderMode", "2d");

    captureSettingsCheckpoint("Test Tunnel");

    // Simulate an apply path: overwrite the keys that existed, and create
    // keys that didn't (tka-viewer3d-camera, tka-scene-features).
    localStorage.setItem(TUNNEL_VIEW_STATE_KEY, "applied-tunnel-state");
    localStorage.setItem(EFFECTS_CONFIG_STORAGE_KEY, "applied-effects");
    localStorage.setItem(VIEWER_MODE_KEY, "tunnel");
    localStorage.setItem("tka-viewer3d-renderMode", "3d");
    localStorage.setItem("tka-viewer3d-camera", '{"x":1}');
    localStorage.setItem(SCENE_FEATURES_KEY, '{"stage":true}');

    const label = revertSettingsCheckpoint();

    expect(label).toBe("Test Tunnel");
    expect(localStorage.getItem(TUNNEL_VIEW_STATE_KEY)).toBe("pristine-tunnel-state");
    expect(localStorage.getItem(EFFECTS_CONFIG_STORAGE_KEY)).toBe("pristine-effects");
    expect(localStorage.getItem(VIEWER_MODE_KEY)).toBe("split");
    expect(localStorage.getItem("tka-viewer3d-renderMode")).toBe("2d");
    // Neither key existed at capture time, so revert removes them rather
    // than writing back a value they never had.
    expect(localStorage.getItem("tka-viewer3d-camera")).toBeNull();
    expect(localStorage.getItem(SCENE_FEATURES_KEY)).toBeNull();
  });

  it("removes a key entirely when it had no value at capture time", () => {
    // Nothing set before capture — a completely fresh install.
    captureSettingsCheckpoint("Empty");
    localStorage.setItem(VIEWER_MODE_KEY, "animation-3d");

    revertSettingsCheckpoint();

    expect(localStorage.getItem(VIEWER_MODE_KEY)).toBeNull();
  });

  it("returns null and touches nothing when there is no checkpoint to revert", () => {
    localStorage.setItem(VIEWER_MODE_KEY, "split");

    expect(revertSettingsCheckpoint()).toBeNull();
    expect(localStorage.getItem(VIEWER_MODE_KEY)).toBe("split");
  });

  it("clears itself after reverting, so a second Undo click is a no-op", () => {
    captureSettingsCheckpoint("Once");

    expect(revertSettingsCheckpoint()).toBe("Once");
    expect(revertSettingsCheckpoint()).toBeNull();
  });

  it("restores semantic singleton values through their live setters", () => {
    const vm = getAnimationVisibilityManager();

    // Pristine state the user configured for themselves.
    vm.setEffortPreset("linear");
    vm.setPathShape("arc");
    vm.setMotionAwarePaths(false);
    vm.setVisibility("bluePathLines", false);
    vm.setVisibility("redPathLines", true);
    animationSettings.updateSettings({
      trail: { ...animationSettings.trail, mode: TrailMode.PERSISTENT, lineWidth: 7 },
    });
    void settingsService.updateSettings({
      bluePropType: PropType.STAFF,
      redPropType: PropType.FAN,
      backgroundType: BackgroundType.COSMIC,
    });

    captureSettingsCheckpoint("Semantic Test");

    // Simulate an apply path overwriting every one of these with the saved
    // tunnel/scene's own values.
    vm.setEffortPreset("bounce");
    vm.setPathShape("concave");
    vm.setMotionAwarePaths(true);
    vm.setVisibility("bluePathLines", true);
    vm.setVisibility("redPathLines", false);
    animationSettings.updateSettings({
      trail: { ...animationSettings.trail, mode: TrailMode.FADE, lineWidth: 2 },
    });
    void settingsService.updateSettings({
      bluePropType: PropType.CLUB,
      redPropType: PropType.CLUB,
      backgroundType: BackgroundType.OCEAN,
    });

    const label = revertSettingsCheckpoint();

    expect(label).toBe("Semantic Test");
    expect(vm.getEffortPreset()).toBe("linear");
    expect(vm.getPathShape()).toBe("arc");
    expect(vm.getMotionAwarePaths()).toBe(false);
    expect(vm.getVisibility("bluePathLines")).toBe(false);
    expect(vm.getVisibility("redPathLines")).toBe(true);
    expect(animationSettings.trail.mode).toBe(TrailMode.PERSISTENT);
    expect(animationSettings.trail.lineWidth).toBe(7);
    expect(settingsService.settings.bluePropType).toBe(PropType.STAFF);
    expect(settingsService.settings.redPropType).toBe(PropType.FAN);
    expect(settingsService.settings.backgroundType).toBe(BackgroundType.COSMIC);
  });
});
