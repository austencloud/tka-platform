<script lang="ts">
  /**
   * Environment3D
   *
   * Switcher component that renders the appropriate 3D environment
   * based on the BackgroundType setting. This unifies the 2D background
   * and 3D environment selection - they are the same setting.
   */

  import { BackgroundType } from "@austencloud/backgrounds";
  import ForestScene from "../scenes/ForestScene.svelte";
  import CosmicScene from "../scenes/CosmicScene.svelte";
  import WinterScene from "../scenes/WinterScene.svelte";
  import OceanScene from "../scenes/OceanScene.svelte";
  import EmberScene from "../scenes/EmberScene.svelte";
  import CherryBlossomScene from "../scenes/CherryBlossomScene.svelte";
  import RainbowScene from "../scenes/RainbowScene.svelte";

  interface Props {
    /** Background type from settings */
    backgroundType: BackgroundType;
  }

  let { backgroundType }: Props = $props();

  // Map BackgroundType to scene type and variant
  type SceneConfig =
    | { scene: "forest"; variant: "autumn" | "firefly" }
    | { scene: "cosmic"; variant: "night" | "aurora" }
    | { scene: "winter" }
    | { scene: "ocean"; variant: "deep" | "reef" }
    | { scene: "ember" }
    | { scene: "cherryBlossom" }
    | { scene: "rainbow" }
    | { scene: "none" };

  function getSceneConfig(bg: BackgroundType): SceneConfig {
    switch (bg) {
      case BackgroundType.AUTUMN_DRIFT:
        return { scene: "forest", variant: "autumn" };
      case BackgroundType.FIREFLY_FOREST:
        return { scene: "forest", variant: "firefly" };
      case BackgroundType.NIGHT_SKY:
        return { scene: "cosmic", variant: "night" };
      case BackgroundType.SNOWFALL:
        return { scene: "winter" };
      case BackgroundType.DEEP_OCEAN:
        return { scene: "ocean", variant: "deep" };
      case BackgroundType.EMBER_GLOW:
        return { scene: "ember" };
      case BackgroundType.CHERRY_BLOSSOM:
        return { scene: "cherryBlossom" };
      case BackgroundType.PRIDE:
        return { scene: "rainbow" };
      // SOLID_COLOR and LINEAR_GRADIENT show no 3D scene
      default:
        return { scene: "none" };
    }
  }

  const config = $derived(getSceneConfig(backgroundType));
</script>

{#if config.scene === "forest"}
  <ForestScene variant={config.variant} />
{:else if config.scene === "cosmic"}
  <CosmicScene variant={config.variant} />
{:else if config.scene === "winter"}
  <WinterScene />
{:else if config.scene === "ocean"}
  <OceanScene variant={config.variant} />
{:else if config.scene === "ember"}
  <EmberScene />
{:else if config.scene === "cherryBlossom"}
  <CherryBlossomScene />
{:else if config.scene === "rainbow"}
  <RainbowScene />
{/if}

<!-- SOLID_COLOR and LINEAR_GRADIENT render nothing - just the default grid -->
