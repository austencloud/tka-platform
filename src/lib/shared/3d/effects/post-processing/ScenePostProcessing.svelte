<script lang="ts">
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import { HalfFloatType, Vector2 } from "three";
  import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    ChromaticAberrationEffect,
    VignetteEffect,
  } from "postprocessing";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { getViewer3DContext } from "../../context/viewer-3d-context";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const { renderer, camera, scene, autoRender, renderStage } = useThrelte();
  const viewer3DState = getViewer3DContext();

  const isOcean = $derived.by(() => {
    try {
      return (settingsService as any)?.settings?.backgroundType === BackgroundType.DEEP_OCEAN;
    } catch {
      return false;
    }
  });

  const shouldCompose = $derived(isOcean && !viewer3DState.isExporting);

  let composer: EffectComposer | null = null;
  let lastW = 0;
  let lastH = 0;
  const _sizeVec = new Vector2();

  function buildComposer() {
    disposeComposer();

    const cam = camera.current;
    const scn = (scene as any).current ?? scene;
    if (!cam || !scn) return;

    composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
    });

    composer.addPass(new RenderPass(scn, cam));

    composer.addPass(
      new EffectPass(
        cam,
        new BloomEffect({
          intensity: 1.5,
          luminanceThreshold: 0.4,
          luminanceSmoothing: 0.3,
          mipmapBlur: true,
          radius: 0.7,
          levels: 8,
        }),
        new ChromaticAberrationEffect({
          offset: new Vector2(0.0006, 0.0006),
          radialModulation: true,
          modulationOffset: 0.2,
        }),
        new VignetteEffect({
          darkness: 0.5,
          offset: 0.25,
        }),
      ),
    );

    renderer.getSize(_sizeVec);
    const w = Math.round(_sizeVec.x);
    const h = Math.round(_sizeVec.y);
    if (w > 0 && h > 0) {
      composer.setSize(w, h);
    }
    lastW = w;
    lastH = h;
  }

  function disposeComposer() {
    if (composer) {
      composer.dispose();
      composer = null;
    }
  }

  $effect(() => {
    const cam = camera.current;
    if (shouldCompose && cam) {
      buildComposer();
    } else {
      disposeComposer();
    }
  });

  let prevAutoRender: boolean | null = null;

  $effect(() => {
    if (shouldCompose && composer) {
      prevAutoRender = autoRender.current;
      autoRender.set(false);
    }

    return () => {
      if (prevAutoRender !== null) {
        autoRender.set(prevAutoRender);
        prevAutoRender = null;
      }
    };
  });

  useTask(
    (delta) => {
      if (!shouldCompose || !composer) return;

      const cam = camera.current;
      if (cam) {
        composer.setMainCamera(cam);
      }

      renderer.getSize(_sizeVec);
      const w = Math.round(_sizeVec.x);
      const h = Math.round(_sizeVec.y);
      if (w < 1 || h < 1) return;
      if (w !== lastW || h !== lastH) {
        composer.setSize(w, h);
        lastW = w;
        lastH = h;
      }

      composer.render(delta);
    },
    { stage: renderStage, autoInvalidate: false },
  );

  onDestroy(() => {
    disposeComposer();
  });
</script>

{@render children()}
