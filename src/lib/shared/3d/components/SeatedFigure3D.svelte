<script lang="ts">
  /**
   * SeatedFigure3D
   *
   * Loads avatar via useGltf, then applies a sitting animation
   * by remapping FBX track names to match this avatar's bone names.
   * No retargetClip — just a prefix swap since all Mixamo skeletons
   * share the same bone layout.
   */

  import { T, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onDestroy } from "svelte";
  import { untrack } from "svelte";
  import { AnimationMixer, LoopRepeat } from "three";
  import {
    seatedAudienceLoader,
  } from "../services/implementations/SeatedAudienceLoader";

  interface Props {
    modelUrl: string;
    animationUrl: string;
    timeOffset?: number;
  }

  const { modelUrl, animationUrl, timeOffset = 0 }: Props = $props();

  const gltf = useGltf(untrack(() => modelUrl));

  let mixer = $state<AnimationMixer | null>(null);
  let animApplied = false;

  $effect(() => {
    const loaded = $gltf;
    if (!loaded || animApplied) return;
    animApplied = true;

    const scene = loaded.scene;

    // Disable frustum culling
    scene.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.frustumCulled = false;
      }
    });

    // Find the skinned mesh
    let targetMesh: any = null;
    scene.traverse((child: any) => {
      if (!targetMesh && child.isSkinnedMesh) {
        targetMesh = child;
      }
    });
    if (!targetMesh) return;

    // Remap the FBX animation tracks to this avatar's bone names
    seatedAudienceLoader.remapAnimation(targetMesh, animationUrl).then((clip) => {
      if (!clip || clip.tracks.length === 0) {
        console.warn(`[SeatedFigure3D] No remapped tracks for ${modelUrl}`);
        return;
      }
      console.log(`[SeatedFigure3D] ${modelUrl}: ${clip.tracks.length} tracks remapped`);

      // Root the mixer on the scene (not the SkinnedMesh) so it can
      // find bones by name via scene graph traversal
      const m = new AnimationMixer(scene);
      const action = m.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      if (timeOffset > 0) m.update(timeOffset);
      mixer = m;
    }).catch((err) => {
      console.error(`[SeatedFigure3D] remap error:`, err);
    });
  });

  useTask((delta) => {
    mixer?.update(delta);
  });

  onDestroy(() => {
    mixer?.stopAllAction();
  });
</script>

{#if $gltf}
  <T is={$gltf.scene} />
{/if}
