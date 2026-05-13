<script lang="ts">
  /**
   * SeatedFigure3D
   *
   * Pulls a pre-baked scene clone + remapped AnimationClip from
   * SeatedAudienceLoader's cache. After SeatedAudience3D.preloadAll
   * has completed, prepareFigure resolves in a microtask and the
   * mixer spins up without any GLB parse, FBX parse, or track remap
   * happening on the main thread during playback.
   */

  import { T, useTask } from "@threlte/core";
  import { onDestroy, onMount } from "svelte";
  import { AnimationMixer, LoopRepeat, type Object3D } from "three";
  import { seatedAudienceLoader } from "@austencloud/scene-3d";

  interface Props {
    modelUrl: string;
    animationUrl: string;
    timeOffset?: number;
  }

  const { modelUrl, animationUrl, timeOffset = 0 }: Props = $props();

  let scene = $state<Object3D | null>(null);
  let mixer = $state<AnimationMixer | null>(null);

  onMount(() => {
    let cancelled = false;
    seatedAudienceLoader
      .prepareFigure(modelUrl, animationUrl)
      .then((prepared) => {
        if (cancelled) return;
        scene = prepared.scene;
        if (!prepared.clip) {
          console.warn(`[SeatedFigure3D] No clip for ${modelUrl} / ${animationUrl}`);
          return;
        }
        const m = new AnimationMixer(prepared.scene);
        const action = m.clipAction(prepared.clip);
        action.setLoop(LoopRepeat, Infinity);
        action.play();
        if (timeOffset > 0) m.update(timeOffset);
        mixer = m;
      })
      .catch((err) => {
        console.error(`[SeatedFigure3D] prepareFigure failed:`, err);
      });
    return () => {
      cancelled = true;
    };
  });

  useTask((delta) => {
    mixer?.update(delta);
  });

  onDestroy(() => {
    mixer?.stopAllAction();
  });
</script>

{#if scene}
  <T is={scene} />
{/if}
