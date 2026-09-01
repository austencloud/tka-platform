// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  ephemeralAdapter,
  createMemoryAdapter,
} from "$lib/shared/animation-engine/state/persistence-adapter";
import {
  ANIMATION_SETTINGS_VERSION,
  DEFAULT_ANIMATION_SETTINGS,
  createAnimationSettingsState,
  migrateAnimationSettings,
} from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";

describe("persistence adapters", () => {
  it("ephemeral adapter never loads or persists", () => {
    expect(ephemeralAdapter.load()).toBeNull();
    ephemeralAdapter.save({ bpm: 120 });
    expect(ephemeralAdapter.load()).toBeNull();
  });

  it("memory adapter round-trips a delta", () => {
    const store: Record<string, unknown> = {};
    const adapter = createMemoryAdapter(store);
    adapter.save({ bpm: 90 });
    expect(adapter.load()).toEqual({ bpm: 90 });
  });
});

describe("ephemeral animation settings", () => {
  it("seeds trail tracking at both ends", () => {
    const settings = createAnimationSettingsState({ ephemeral: true });

    expect(settings.trail.trackingMode).toBe(TrackingMode.BOTH_ENDS);
    expect(settings.trail.lineWidth).toBe(4);
    expect(settings.trail.glowBlur).toBe(2.5);
  });

  it("seeds from defaults and does not write localStorage", () => {
    let wrote = false;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      wrote = true;
    });
    const settings = createAnimationSettingsState({ ephemeral: true });
    settings.setBpm(99);
    expect(settings.bpm).toBe(99);
    expect(wrote).toBe(false);
    spy.mockRestore();
  });
});

describe("animation settings migrations", () => {
  it("promotes the inherited thumb-end default to both ends once", () => {
    const legacy = {
      ...DEFAULT_ANIMATION_SETTINGS,
      version: 1,
      trail: {
        ...DEFAULT_ANIMATION_SETTINGS.trail,
        trackingMode: TrackingMode.RIGHT_END,
      },
    };

    const migrated = migrateAnimationSettings(legacy, legacy.version);

    expect(migrated.version).toBe(ANIMATION_SETTINGS_VERSION);
    expect(migrated.trail.trackingMode).toBe(TrackingMode.BOTH_ENDS);
  });

  it("preserves an explicit thumb-end choice after the migration", () => {
    const current = {
      ...DEFAULT_ANIMATION_SETTINGS,
      trail: {
        ...DEFAULT_ANIMATION_SETTINGS.trail,
        trackingMode: TrackingMode.RIGHT_END,
      },
    };

    const migrated = migrateAnimationSettings(current, ANIMATION_SETTINGS_VERSION);

    expect(migrated.trail.trackingMode).toBe(TrackingMode.RIGHT_END);
  });
});

describe("AnimationScope", () => {
  it("ephemeral scope isolates path shape from a second scope", () => {
    const a = createAnimationScope({ persistence: "ephemeral" });
    const b = createAnimationScope({ persistence: "ephemeral" });
    a.visibility.setPathShape("concave");
    expect(a.visibility.getPathShape()).toBe("concave");
    expect(b.visibility.getPathShape()).toBe("arc"); // default, unaffected
  });

  it("derives speed from bpm", () => {
    const s = createAnimationScope({ persistence: "ephemeral" });
    s.settings.setBpm(120);
    expect(s.speed).toBe(2); // 120 / 60
  });
});

describe("scope isolation regression (the reported bug)", () => {
  it("one scope's motion-aware paths do not leak into another", () => {
    const userScope = createAnimationScope({ persistence: "ephemeral" });
    const landingScope = createAnimationScope({ persistence: "ephemeral" });
    userScope.visibility.toggleMotionAwarePaths(); // user turns Hybrid ON
    expect(userScope.visibility.getMotionAwarePaths()).toBe(true);
    expect(landingScope.visibility.getMotionAwarePaths()).toBe(false); // landing stays OFF
  });
});
