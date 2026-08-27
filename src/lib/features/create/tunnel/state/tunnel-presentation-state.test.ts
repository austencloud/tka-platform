import { describe, expect, it } from "vitest";
import {
  createAnimationSettingsState,
  DEFAULT_TRAIL_SETTINGS,
} from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import type { TunnelSnapshot } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import type { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
import { createTunnelPresentationState } from "./tunnel-presentation-state.svelte";

function savedSnapshot(): TunnelSnapshot {
  return {
    version: 2,
    tunnel: {
      config: {
        ...DEFAULT_CONFIG,
        fold: 4,
        mirror: true,
        staggerSteps: 2,
        speedOverrides: { 1: 0.5 },
      },
      gridVisible: true,
      spectrum: false,
      section: "props",
      presetRecipe: null,
    },
    effects: structuredClone(DEFAULT_EFFECTS_CONFIG),
    effort: "punch",
    paths: {
      pathShape: "concave",
      motionAwarePaths: true,
      bluePathLines: true,
      redPathLines: false,
    },
    playback: { bpm: 132, playbackMode: "step" },
    props: {
      bluePropType: "buugeng",
      redPropType: "buugeng",
      blueBuugengFlipped: true,
      redBuugengFlipped: false,
    },
    trailRender: {
      ...structuredClone(DEFAULT_TRAIL_SETTINGS),
      tailLength: 48,
      hideProps: true,
    },
  };
}

function controllerFor(): TunnelViewController {
  const state = {
    config: { ...DEFAULT_CONFIG, speedOverrides: {} },
    gridVisible: false,
    spectrum: true,
    section: "tunnel" as TunnelSnapshot["tunnel"]["section"],
    presetRecipe: null as TunnelSnapshot["tunnel"]["presetRecipe"],
  };
  return {
    get config() {
      return state.config;
    },
    get gridVisible() {
      return state.gridVisible;
    },
    set gridVisible(value) {
      state.gridVisible = value;
    },
    get spectrum() {
      return state.spectrum;
    },
    set spectrum(value) {
      state.spectrum = value;
    },
    get section() {
      return state.section;
    },
    set section(value) {
      state.section = value;
    },
    get presetRecipe() {
      return state.presetRecipe;
    },
    set presetRecipe(value) {
      state.presetRecipe = value;
    },
    applyConfig(config, recipe) {
      state.config = JSON.parse(JSON.stringify(config));
      if (recipe !== undefined) state.presetRecipe = recipe;
    },
  } as unknown as TunnelViewController;
}

describe("tunnel presentation state", () => {
  it("restores and recaptures every saved presentation field", () => {
    const snapshot = savedSnapshot();
    const effects = createEffectsConfigState(undefined, { persist: false });
    const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
    const animationSettings = createAnimationSettingsState({ ephemeral: true });
    const state = createTunnelPresentationState({
      initialSnapshot: snapshot,
      effects,
      visibility,
      animationSettings,
      initialBluePropType: "staff",
      initialRedPropType: "staff",
      initialBlueBuugengFlipped: false,
      initialRedBuugengFlipped: true,
    });
    const controller = controllerFor();

    state.attachController(controller);

    expect(state.capture()).toEqual(snapshot);
    expect(state.chirality.hands.map((hand) => hand.flipped)).toEqual([
      true,
      false,
    ]);
  });

  it("captures live edits without writing through to the supplied defaults", () => {
    const effects = createEffectsConfigState(undefined, { persist: false });
    const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
    const animationSettings = createAnimationSettingsState({ ephemeral: true });
    const state = createTunnelPresentationState({
      initialFormation: { ...DEFAULT_CONFIG, fold: 2 },
      effects,
      visibility,
      animationSettings,
      initialBluePropType: "staff",
      initialRedPropType: "staff",
      initialBlueBuugengFlipped: false,
      initialRedBuugengFlipped: false,
    });
    const controller = controllerFor();
    state.attachController(controller);

    state.setBpm(144);
    state.setPlaybackMode("step");
    state.setPropType("fan");
    state.chirality.onChange("red", true);
    visibility.setEffortPreset("glide");
    visibility.setPathPolicy({ pathShape: "linear", motionAwarePaths: true });
    controller.gridVisible = true;
    controller.section = "playback";

    expect(state.capture()).toMatchObject({
      tunnel: {
        config: { fold: 2 },
        gridVisible: true,
        section: "playback",
        presetRecipe: null,
      },
      effort: "glide",
      paths: { pathShape: "linear", motionAwarePaths: true },
      playback: { bpm: 144, playbackMode: "step" },
      props: {
        bluePropType: "fan",
        redPropType: "fan",
        blueBuugengFlipped: false,
        redBuugengFlipped: true,
      },
    });
  });
});
