<script lang="ts">
  import { T } from "@threlte/core";
  import {
    type PureBlackSceneConfig,
    createDefaultPureBlackConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import VoidPlatform from "./pure-black/VoidPlatform.svelte";

  interface Props {
    config?: PureBlackSceneConfig;
  }

  let { config }: Props = $props();

  const activeConfig = $derived(config ?? createDefaultPureBlackConfig());

  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    sceneFeatures?.reportReady("environment");
  });
</script>

<VoidPlatform config={activeConfig.platform} />

<T.AmbientLight intensity={activeConfig.ambientIntensity} />
<T.DirectionalLight position={[5, 10, 5]} intensity={0.3} />
