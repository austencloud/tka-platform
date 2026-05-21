<script lang="ts">
  /**
   * Environment3D
   *
   * Switcher component that renders the appropriate 3D environment
   * based on the BackgroundType setting. This unifies the 2D background
   * and 3D environment selection - they are the same setting.
   */

  import { BackgroundType } from "@austencloud/backgrounds";
  import { useThrelte } from "@threlte/core";
  import { untrack } from "svelte";
  import ForestScene from "../scenes/ForestScene.svelte";
  import AutumnScene from "../scenes/AutumnScene.svelte";
  import CosmicScene from "../scenes/CosmicScene.svelte";
  import WinterScene from "../scenes/WinterScene.svelte";
  import OceanScene from "../scenes/OceanScene.svelte";
  import EmberScene from "../scenes/EmberScene.svelte";
  import BlossomScene from "../scenes/BlossomScene.svelte";
  import RainbowScene from "../scenes/RainbowScene.svelte";
  import CelestialScene from "../scenes/CelestialScene.svelte";
  import VoidScene from "../scenes/VoidScene.svelte";
  import type { OceanVariant } from "../domain/enums/environment-enums";

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
    /** Ocean sub-variant selection */
    oceanVariant?: OceanVariant;
  }

  let { backgroundType, performerCount = 1, stageWidth = 6, stageDepth = 6, stageZOffset = 0, oceanVariant }: Props = $props();

  const { scene, renderer } = useThrelte();

  // Map BackgroundType to scene type and variant
  type SceneConfig =
    | { scene: "forest"; variant: "firefly" }
    | { scene: "autumn" }
    | { scene: "cosmic"; variant: "night" | "aurora" }
    | { scene: "winter" }
    | { scene: "ocean"; variant: "abyss" | "reef" | "mystical" | "cinematic" }
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
        return { scene: "ocean", variant: (oceanVariant ?? "abyss") as "abyss" | "reef" | "mystical" | "cinematic" };
      case BackgroundType.EMBER:
        return { scene: "ember" };
      case BackgroundType.BLOSSOM:
        return { scene: "blossom" };
      case BackgroundType.RAINBOW:
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

  const config = $derived(getSceneConfig(backgroundType));

  // Force a clean frame between scene swaps. When the scene type changes,
  // briefly render nothing so the old scene's fog, sky dome, and objects
  // are fully removed before the new scene mounts. Without this, stale
  // Three.js state from the departing scene bleeds into the arriving one.
  let mountedScene = $state(untrack(() => config.scene));
  let ready = $state(true);

  // Threlte's scene can be a CurrentWritable ({current: Scene}) or the Scene directly
  function getScene() {
    return (scene as any)?.current ?? (scene as any);
  }
  function getRenderer() {
    return (renderer as any)?.current ?? (renderer as any);
  }

  $effect(() => {
    const next = config.scene;
    if (next !== mountedScene) {
      const s = getScene();
      const r = getRenderer();
      if (s?.isScene) {
        s.fog = null;
        s.background = null;
        s.environment = null;
      }
      if (r?.clear) r.clear();
      ready = false;
      mountedScene = next;
      requestAnimationFrame(() => {
        ready = true;
      });
    }
  });
</script>

{#if ready}
  {#if config.scene === "forest"}
    <ForestScene variant={config.variant} {stageWidth} {stageDepth} {stageZOffset} />
  {:else if config.scene === "autumn"}
    <AutumnScene {stageWidth} {stageDepth} {stageZOffset} />
  {:else if config.scene === "cosmic"}
    <CosmicScene variant={config.variant} {performerCount} {stageWidth} {stageDepth} />
  {:else if config.scene === "winter"}
    <WinterScene {stageWidth} {stageDepth} {stageZOffset} />
  {:else if config.scene === "ocean"}
    <OceanScene variant={config.variant} {performerCount} {stageWidth} {stageDepth} {stageZOffset} />
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
{/if}

<!-- Unrecognized background types render nothing - just the default grid -->
