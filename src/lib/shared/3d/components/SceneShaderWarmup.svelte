<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { tick } from "svelte";
  import type { Camera, Scene, WebGLRenderer } from "three";

  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";

  interface Props {
    onReadyChange?: (ready: boolean) => void;
  }

  let { onReadyChange }: Props = $props();

  const { renderer, scene, camera } = useThrelte() as unknown as {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: { current: Camera };
  };
  const sceneFeatures = getSceneFeatureContext();

  $effect(() => {
    const featuresReady = sceneFeatures.allEnabledReady;
    const activeCamera = camera.current;
    onReadyChange?.(false);
    if (!featuresReady || !activeCamera) return;

    let cancelled = false;

    async function compileScene(): Promise<void> {
      // Readiness can be reported in the same update that mounts the final GLB.
      // Let Svelte attach it to the Three scene before asking the driver to
      // compile every visible shader behind the loading curtain.
      await tick();
      if (cancelled) return;

      try {
        await renderer.compileAsync(scene, activeCamera);
      } catch (error) {
        // A compile hint is an optimization, not a reason to strand the user.
        // Three will still compile missing programs on their first real draw.
        console.warn("[SceneShaderWarmup] shader precompile failed", error);
      }

      if (!cancelled) onReadyChange?.(true);
    }

    void compileScene();

    return () => {
      cancelled = true;
    };
  });
</script>
