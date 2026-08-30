<script lang="ts">
  import { T } from "@threlte/core";
  import {
    type VoidSceneConfig,
    createDefaultVoidConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import VoidPlatform from "./pure-black/VoidPlatform.svelte";
  import { resolveCircularStageRadius } from "../domain/performer-stage-bounds";

  interface Props {
    config?: VoidSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
  }

  let { config, stageRadius = 3, stageRadiusGrowth = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultVoidConfig());

  const activeConfig = $derived.by(() => {
    const r = resolveCircularStageRadius(
      stageRadius,
      baseConfig.platform.radius,
      undefined,
      stageRadiusGrowth
    );
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
