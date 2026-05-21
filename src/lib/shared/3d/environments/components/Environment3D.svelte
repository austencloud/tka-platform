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
  import CherryBlossomScene from "../scenes/CherryBlossomScene.svelte";
  import RainbowScene from "../scenes/RainbowScene.svelte";
  import CelestialScene from "../scenes/CelestialScene.svelte";
  import type { OceanVariant } from "../domain/enums/environment-enums";

  interface Props {
    /** Background type from settings */
    backgroundType: BackgroundType;
    /** Minimum platform radius to fit all performers. 0 = use scene default. */
    minPlatformRadius?: number;
    /** Ocean sub-variant selection */
    oceanVariant?: OceanVariant;
  }

  let { backgroundType, minPlatformRadius = 0, oceanVariant }: Props = $props();

  const { scene, renderer } = useThrelte();

  // Map BackgroundType to scene type and variant
  type SceneConfig =
    | { scene: "forest"; variant: "firefly" }
    | { scene: "autumn" }
    | { scene: "cosmic"; variant: "night" | "aurora" }
    | { scene: "winter" }
    | { scene: "ocean"; variant: "abyss" | "reef" | "mystical" | "cinematic" }
    | { scene: "ember" }
    | { scene: "cherryBlossom" }
    | { scene: "rainbow" }
    | { scene: "celestial" }
    | { scene: "none" };

  function getSceneConfig(bg: BackgroundType): SceneConfig {
    switch (bg) {
      case BackgroundType.AUTUMN_DRIFT:
        return { scene: "autumn" };
      case BackgroundType.FIREFLY_FOREST:
        return { scene: "forest", variant: "firefly" };
      case BackgroundType.NIGHT_SKY:
        return { scene: "cosmic", variant: "night" };
      case BackgroundType.SNOWFALL:
        return { scene: "winter" };
      case BackgroundType.DEEP_OCEAN:
        return { scene: "ocean", variant: (oceanVariant ?? "abyss") as "abyss" | "reef" | "mystical" | "cinematic" };
      case BackgroundType.EMBER_GLOW:
        return { scene: "ember" };
      case BackgroundType.CHERRY_BLOSSOM:
        return { scene: "cherryBlossom" };
      case BackgroundType.PRIDE:
        return { scene: "rainbow" };
      case BackgroundType.CELESTIAL:
        return { scene: "celestial" };
      // SOLID_COLOR and LINEAR_GRADIENT show no 3D scene
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

  // DEBUG: expose scene globally + log every reactive change
  $effect(() => {
    const s = getScene();
    const r = getRenderer();
    if (s?.isScene) {
      (window as any).__tkaScene = s;
    }
    if (r?.domElement) {
      (window as any).__tkaRenderer = r;
    }
    const childCount = s?.children?.length ?? -1;
    const meshCount = childCount > 0 ? s.children.filter((c: any) => c.isMesh || c.isGroup).length : 0;
    console.warn("[Env3D] bg=%s scene=%s mounted=%s ready=%s children=%d meshes/groups=%d fog=%s",
      backgroundType, config.scene, mountedScene, ready,
      childCount, meshCount,
      s?.fog ? "yes" : "no"
    );
  });

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
    <ForestScene variant={config.variant} />
  {:else if config.scene === "autumn"}
    <AutumnScene />
  {:else if config.scene === "cosmic"}
    <CosmicScene variant={config.variant} {minPlatformRadius} />
  {:else if config.scene === "winter"}
    <WinterScene />
  {:else if config.scene === "ocean"}
    <OceanScene variant={config.variant} {minPlatformRadius} />
  {:else if config.scene === "ember"}
    <EmberScene />
  {:else if config.scene === "cherryBlossom"}
    <CherryBlossomScene />
  {:else if config.scene === "rainbow"}
    <RainbowScene />
  {:else if config.scene === "celestial"}
    <CelestialScene />
  {/if}
{/if}

<!-- SOLID_COLOR and LINEAR_GRADIENT render nothing - just the default grid -->
