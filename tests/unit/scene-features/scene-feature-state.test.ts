import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
import { SCENE_FEATURES } from "$lib/shared/3d/scene-features/domain/scene-feature-registry";

describe("createSceneFeatureState", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("initializes with registry defaults when no localStorage or overrides", () => {
    const state = createSceneFeatureState();
    expect(state.isEnabled("stage")).toBe(true);
    expect(state.isEnabled("audience")).toBe(false);
    expect(state.isEnabled("environment")).toBe(true);
  });

  it("applies overrides over registry defaults", () => {
    const state = createSceneFeatureState({ audience: true });
    expect(state.isEnabled("audience")).toBe(true);
  });

  it("localStorage wins over overrides", () => {
    mockStorage.set("tka-scene-features", JSON.stringify({ audience: false }));
    const state = createSceneFeatureState({ audience: true });
    expect(state.isEnabled("audience")).toBe(false);
  });

  it("toggle flips state and persists to localStorage", () => {
    const state = createSceneFeatureState();
    expect(state.isEnabled("stage")).toBe(true);
    state.toggle("stage");
    expect(state.isEnabled("stage")).toBe(false);
    const stored = JSON.parse(mockStorage.get("tka-scene-features")!);
    expect(stored.stage).toBe(false);
  });

  it("allEnabledReady is true when no async features are enabled", () => {
    const state = createSceneFeatureState();
    state.toggle("environment"); // off
    expect(state.allEnabledReady).toBe(true);
  });

  it("allEnabledReady is false when async feature is enabled but not ready", () => {
    const state = createSceneFeatureState();
    expect(state.allEnabledReady).toBe(false);
  });

  it("allEnabledReady becomes true after all enabled async features report ready", () => {
    const state = createSceneFeatureState();
    state.reportReady("environment");
    expect(state.allEnabledReady).toBe(true);
  });

  it("readyProgress tracks fraction of ready async features", () => {
    const state = createSceneFeatureState({ audience: true });
    expect(state.readyProgress).toBe(0);
    state.reportReady("environment");
    expect(state.readyProgress).toBe(0.5);
    state.reportReady("audience");
    expect(state.readyProgress).toBe(1);
  });

  it("disabling an async feature recalculates readiness", () => {
    const state = createSceneFeatureState({ audience: true });
    expect(state.allEnabledReady).toBe(false);
    state.toggle("environment");
    state.toggle("audience");
    expect(state.allEnabledReady).toBe(true);
  });

  it("reset clears localStorage and reverts to defaults", () => {
    const state = createSceneFeatureState();
    state.toggle("stage");
    state.toggle("audience");
    state.reset();
    expect(state.isEnabled("stage")).toBe(true);
    expect(state.isEnabled("audience")).toBe(false);
    expect(mockStorage.has("tka-scene-features")).toBe(false);
  });

  it("features exposes the full registry", () => {
    const state = createSceneFeatureState();
    expect(state.features).toBe(SCENE_FEATURES);
  });
});
