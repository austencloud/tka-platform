<script lang="ts">
  import { T } from "@threlte/core";
  import {
    type VoidSceneConfig,
    createDefaultVoidConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import VoidPlatform from "./pure-black/VoidPlatform.svelte";

  interface Props {
    config?: VoidSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { config, stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultVoidConfig());

  const activeConfig = $derived.by(() => {
    const neededRadius = Math.max(stageWidth, stageDepth) / 2;
    const r = Math.max(baseConfig.platform.radius, neededRadius);
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    sceneFeatures?.reportReady("environment");
  });
</script>

<VoidPlatform config={activeConfig.platform} />

<T.AmbientLight intensity={activeConfig.ambientIntensity} />
<T.DirectionalLight position={[5, 10, 5]} intensity={0.3} />
