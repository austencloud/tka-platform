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
  // import { GodraysPass } from "three-good-godrays"; // re-enable after depth-copy fix
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { WaterAbsorptionEffect } from "./ocean/WaterAbsorptionEffect";
  import { UnderwaterDistortionEffect } from "./ocean/UnderwaterDistortionEffect";
  import { RefractionCausticsEffect } from "./ocean/RefractionCausticsEffect";
  import { godraysLightStore } from "./godrays-light-store.svelte";

  interface Props {
    children: Snippet;
    bloomResolutionScale?: number;
    bloomLevels?: number;
    enableBloom?: boolean;
    enableChromaticAberration?: boolean;
  }

  let {
    children,
    bloomResolutionScale = 1.0,
    bloomLevels = 8,
    enableBloom = true,
    enableChromaticAberration = true,
  }: Props = $props();

  const _ctx = useThrelte() as any;
  const renderer: import("three").WebGLRenderer = _ctx.renderer;
  const camera: { current: import("three").Camera } = _ctx.camera;
  const scene: import("three").Scene = _ctx.scene;
  const autoRender: { current: boolean; set: (v: boolean) => void } = _ctx.autoRender;
  const renderStage = _ctx.renderStage;
  const viewer3DState = getViewer3DContext();

  const isOcean = $derived.by(() => {
    try {
      return (settingsService as any)?.settings?.backgroundType === BackgroundType.OCEAN;
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

    // Volumetric god rays — disabled pending depth-copy fix.
    // GodraysPass adds an extra swap that creates odd parity: the next
    // depth-reading EffectPass writes to the same target that holds the
    // depth texture, triggering GL_INVALID_OPERATION feedback-loop errors.
    // TODO: add a DepthCopyPass or implement god rays as an Effect (not Pass)
    // to maintain even ping-pong parity.
    if (isOcean) {
      renderer.shadowMap.enabled = true;
    }

    const effects: import("postprocessing").Effect[] = [];

    if (isOcean) {
      effects.push(new WaterAbsorptionEffect());
      effects.push(new RefractionCausticsEffect());
    }

    if (enableBloom) {
      effects.push(
        new BloomEffect({
          intensity: 1.5,
          luminanceThreshold: 0.4,
          luminanceSmoothing: 0.3,
          mipmapBlur: true,
          radius: 0.7,
          levels: bloomLevels,
          resolutionScale: bloomResolutionScale,
        }),
      );
    }

    effects.push(
      new VignetteEffect({
        darkness: 0.5,
        offset: 0.25,
      }),
    );

    if (effects.length > 0) {
      composer.addPass(new EffectPass(cam, ...effects));
    }

    if (isOcean) {
      composer.addPass(new EffectPass(cam, new UnderwaterDistortionEffect()));
    }

    if (enableChromaticAberration) {
      composer.addPass(
        new EffectPass(
          cam,
          new ChromaticAberrationEffect({
            offset: new Vector2(0.0006, 0.0006),
            radialModulation: true,
            modulationOffset: 0.2,
          }),
        ),
      );
    }

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
      renderer.autoClear = true;
      renderer.shadowMap.enabled = false;
    }
  }

  $effect(() => {
    const cam = camera.current;
    const _godLight = godraysLightStore.light;
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
