<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
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
  }

  let { config, stageRadius = 3 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultVoidConfig());

  const activeConfig = $derived.by(() => {
    const r = resolveCircularStageRadius(
      stageRadius,
      baseConfig.platform.radius
    );
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  const { scene, renderer, camera } = useThrelte();
  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    if (renderer.current && camera.current && scene.current) {
      renderer.current.compile(scene.current, camera.current);
    }
    sceneFeatures?.reportReady("environment");
  });
</script>

<VoidPlatform config={activeConfig.platform} />

<T.AmbientLight intensity={activeConfig.ambientIntensity} />
<T.DirectionalLight position={[5, 10, 5]} intensity={0.3} />
