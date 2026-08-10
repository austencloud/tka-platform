<script lang="ts">
  /**
   * Environment3D
   *
   * Switcher component that renders the appropriate 3D environment
   * based on the BackgroundType setting. This unifies the 2D background
   * and 3D environment selection - they are the same setting.
   */

  import { BackgroundType } from "@austencloud/backgrounds";
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import ForestScene from "../scenes/ForestScene.svelte";
  import AutumnScene from "../scenes/AutumnScene.svelte";
  import CosmicScene from "../scenes/CosmicScene.svelte";
  import WinterScene from "../scenes/WinterScene.svelte";
  import OceanScene from "../scenes/ocean/OceanScene.svelte";
  import EmberScene from "../scenes/EmberScene.svelte";
  import BlossomScene from "../scenes/BlossomScene.svelte";
  import RainbowScene from "../scenes/RainbowScene.svelte";
  import CelestialScene from "../scenes/CelestialScene.svelte";
  import VoidScene from "../scenes/VoidScene.svelte";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { getStageCoordinateFrame } from "../domain/stage-coordinate-frame";
  import { tryGetEnvironmentTransitionVisualContext } from "../context/environment-transition-visual-context";
  import type { ForestSceneConfig } from "../domain/models/scene-configs/forest-scene-config";
  import {
    DEFAULT_ENVIRONMENT_TRANSITION_TIMING,
    advanceEnvironmentTransition,
    createEnvironmentTransitionState,
    getEnvironmentVeilOpacity,
    requestEnvironment,
    type EnvironmentTransitionObservation,
  } from "../domain/environment-transition";

  interface Props {
    /** Background type from settings */
    backgroundType: BackgroundType;
    /** Number of performers on stage. Scenes use this to size platforms. */
    performerCount?: number;
    /** Computed stage width from performer bounding box. */
    stageWidth?: number;
    /** Computed stage depth from performer bounding box. */
    stageDepth?: number;
    /** Z offset for stage expansion (keeps front edge fixed). */
    stageZOffset?: number;
    /** Forest-only authored atmosphere override. Other scenes ignore it. */
    forestConfig?: ForestSceneConfig;
    /** Winter review harness may hide the legacy ice platform behind a revision overlay. */
    winterPlatformVisible?: boolean;
    /** Reports the transition owner's semantic state for hosts and diagnostics. */
    onTransitionChange?: (
      observation: EnvironmentTransitionObservation<BackgroundType>
    ) => void;
  }

  let {
    backgroundType,
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    forestConfig,
    winterPlatformVisible = true,
    onTransitionChange,
  }: Props = $props();

  const { scene, renderer } = useThrelte();
  const sceneFeatures = getSceneFeatureContext();
  // Full viewer canvases provide the DOM veil and shader readiness signal.
  // Smaller embedded canvases can still mount Environment3D safely; they use
  // the reduced-motion timing instead of waiting for a visual host they do not
  // own.
  const transitionVisual = tryGetEnvironmentTransitionVisualContext();

  // Map BackgroundType to scene type and variant
  type SceneConfig =
    | { scene: "forest"; variant: "firefly" }
    | { scene: "autumn" }
    | { scene: "cosmic"; variant: "night" | "aurora" }
    | { scene: "winter" }
    | { scene: "ocean" }
    | { scene: "ember" }
    | { scene: "blossom" }
    | { scene: "rainbow" }
    | { scene: "celestial" }
    | { scene: "void" }
    | { scene: "none" };

  function getSceneConfig(bg: BackgroundType): SceneConfig {
    switch (bg) {
      case BackgroundType.AUTUMN:
        return { scene: "autumn" };
      case BackgroundType.FOREST:
        return { scene: "forest", variant: "firefly" };
      case BackgroundType.COSMIC:
        return { scene: "cosmic", variant: "night" };
      case BackgroundType.WINTER:
        return { scene: "winter" };
      case BackgroundType.OCEAN:
        return { scene: "ocean" };
      case BackgroundType.EMBER:
        return { scene: "ember" };
      case BackgroundType.BLOSSOM:
        return { scene: "blossom" };
      case BackgroundType.PRIDE:
        return { scene: "rainbow" };
      case BackgroundType.CELESTIAL:
        return { scene: "celestial" };
      case BackgroundType.VOID:
        return { scene: "void" };
      // Unrecognized types show no 3D scene
      default:
        return { scene: "none" };
    }
  }

  let transition = $state(
    createEnvironmentTransitionState(untrack(() => backgroundType))
  );
  let prefersReducedMotion = $state(false);

  const mountedBackgroundType = $derived(transition.mountedKey);
  const config = $derived(
    mountedBackgroundType === null
      ? ({ scene: "none" } as const)
      : getSceneConfig(mountedBackgroundType)
  );
  const coordinateFrame = $derived(
    mountedBackgroundType === null
      ? null
      : getStageCoordinateFrame(
          mountedBackgroundType,
          sceneFeatures.isEnabled("stage")
        )
  );
  const environmentYOffset = $derived(coordinateFrame?.environmentYOffset ?? 0);
  const transitionTiming = $derived(
    prefersReducedMotion || !transitionVisual
      ? { coverDurationMs: 0, revealDurationMs: 0 }
      : DEFAULT_ENVIRONMENT_TRANSITION_TIMING
  );
  const mountedEnvironmentSettled = $derived(
    mountedBackgroundType !== null &&
      (sceneFeatures.getError("environment") !== null ||
        (sceneFeatures.isReady("environment") &&
          (transitionVisual?.rendererReady ?? true)))
  );

  // Threlte's scene can be a CurrentWritable ({current: Scene}) or the Scene directly
  function getScene() {
    return (scene as any)?.current ?? (scene as any);
  }
  function getRenderer() {
    return (renderer as any)?.current ?? (renderer as any);
  }

  function clearSceneGlobals(): void {
    const s = getScene();
    const r = getRenderer();
    if (s?.isScene) {
      s.fog = null;
      s.background = null;
      s.environment = null;
    }
    if (r?.clear) r.clear();
  }

  $effect(() => {
    const requestedBackground = backgroundType;
    // This effect belongs to the scene-choice prop, not to the animation
    // state it updates. Reading transition outside untrack makes every frame
    // reschedule this effect; during covering that used to become an endless
    // same-scene write before the renderer could paint another frame.
    untrack(() => {
      const currentTransition = transition;
      const nextTransition = requestEnvironment(
        currentTransition,
        requestedBackground
      );
      if (nextTransition === currentTransition) return;

      if (requestedBackground !== currentTransition.mountedKey) {
        transitionVisual?.setRendererReady(false);
      }
      transition = nextTransition;
    });
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      prefersReducedMotion = media.matches;
    };
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  });

  let previousMountedBackground = untrack(() => transition.mountedKey);
  $effect(() => {
    const mounted = transition.mountedKey;
    if (mounted === null && previousMountedBackground !== null) {
      clearSceneGlobals();
      // Clear readiness in the empty-frame phase itself. Deferring this to a
      // microtask can erase the next environment's cached-asset ready signal
      // after it mounts, stranding the transition until the safety timeout.
      sceneFeatures.resetReady("environment");
    }
    previousMountedBackground = mounted;
  });

  $effect(() => {
    transitionVisual?.setFrame(
      getEnvironmentVeilOpacity(transition),
      transition.phase
    );
  });

  $effect(() => {
    const observation: EnvironmentTransitionObservation<BackgroundType> = {
      requestedKey: transition.requestedKey,
      mountedKey: transition.mountedKey,
      phase: transition.phase,
      settled: transition.phase === "idle" && mountedEnvironmentSettled,
    };
    untrack(() => onTransitionChange?.(observation));
  });

  useTask((delta) => {
    transition = advanceEnvironmentTransition(
      transition,
      delta * 1000,
      mountedEnvironmentSettled,
      transitionTiming
    );
  });

  onDestroy(() => {
    clearSceneGlobals();
    transitionVisual?.reset();
  });
</script>

{#if coordinateFrame}
  <T.Group position.y={environmentYOffset}>
    {#if config.scene === "forest"}
      <ForestScene
        variant={config.variant}
        config={forestConfig}
        {stageWidth}
        {stageDepth}
        {stageZOffset}
      />
    {:else if config.scene === "autumn"}
      <AutumnScene {stageWidth} {stageDepth} {stageZOffset} />
    {:else if config.scene === "cosmic"}
      <CosmicScene
        variant={config.variant}
        {performerCount}
        {stageWidth}
        {stageDepth}
      />
    {:else if config.scene === "winter"}
      <WinterScene
        {stageWidth}
        {stageDepth}
        {stageZOffset}
        platformVisible={winterPlatformVisible}
      />
    {:else if config.scene === "ocean"}
      <OceanScene
        {performerCount}
        {stageWidth}
        {stageDepth}
        {stageZOffset}
        worldYOffset={environmentYOffset}
      />
    {:else if config.scene === "ember"}
      <EmberScene {stageWidth} {stageDepth} {stageZOffset} />
    {:else if config.scene === "blossom"}
      <BlossomScene {stageWidth} {stageDepth} {stageZOffset} />
    {:else if config.scene === "rainbow"}
      <RainbowScene {stageWidth} {stageDepth} {stageZOffset} />
    {:else if config.scene === "celestial"}
      <CelestialScene {stageWidth} {stageDepth} {stageZOffset} />
    {:else if config.scene === "void"}
      <VoidScene {stageWidth} {stageDepth} {stageZOffset} />
    {/if}
  </T.Group>
{/if}

<!-- Unrecognized background types render nothing - just the default grid -->
