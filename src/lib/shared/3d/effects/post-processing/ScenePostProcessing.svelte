<script lang="ts">
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import { HalfFloatType, Vector2, AgXToneMapping, NoToneMapping } from "three";
  import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    ChromaticAberrationEffect,
    VignetteEffect,
  } from "postprocessing";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { WaterAbsorptionEffect } from "./ocean/water-absorption-effect";
  import { UnderwaterDistortionEffect } from "./ocean/underwater-distortion-effect";
  import { oceanDebugToggles } from "$lib/shared/3d/environments/scenes/ocean/quality/ocean-debug-toggles.svelte";
  import { getQualityTierDetector } from "../quality/get-quality-tier-detector";

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
      return settingsService.settings?.backgroundType === BackgroundType.OCEAN;
    } catch {
      return false;
    }
  });

  // Tier-gated glow: on HIGH/MEDIUM the effects quality tier enables bloom, so
  // the consolidated 3D trail (HDR-emissive ribbon) blooms in ANY scene, not
  // just ocean. On LOW the trail's in-shader halo alone carries the glow and no
  // composer runs. Trails default-on in the viewer, so tier is the right gate.
  const tierBloom = $derived(getQualityTierDetector().currentConfig.enableBloom);
  const shouldCompose = $derived(
    (isOcean || tierBloom) && !viewer3DState.isExporting,
  );

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

    if (isOcean) {
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = AgXToneMapping;
      renderer.toneMappingExposure = 1.0;
    }

    if (isOcean) {
      // Water absorption (depth tint) only. The post-process refraction caustics
      // overlay was removed — like the god rays it read as a blurry full-screen
      // haze rather than grounded seabed light.
      composer.addPass(
        new EffectPass(
          cam,
          new WaterAbsorptionEffect({
            absorptionR: 0.02,
            absorptionG: 0.005,
            absorptionB: 0.001,
            maxDepth: 50.0,
          }),
        ),
      );
    }

    const colorEffects: import("postprocessing").Effect[] = [];

    // Ocean keeps its authored bloom toggle; non-ocean scenes bloom only when
    // the quality tier allows it (HIGH/MEDIUM) so the HDR trail glows.
    const wantBloom = isOcean ? enableBloom : tierBloom;
    if (wantBloom) {
      colorEffects.push(
        new BloomEffect({
          intensity: 0.8,
          luminanceThreshold: 0.6,
          luminanceSmoothing: 0.3,
          mipmapBlur: true,
          radius: 0.5,
          levels: bloomLevels,
          resolutionScale: bloomResolutionScale,
        }),
      );
    }

    // Vignette + chromatic aberration are ocean-era polish. Keep non-ocean
    // scenes clean — they get bloom only, nothing else changes.
    if (isOcean) {
      colorEffects.push(
        new VignetteEffect({
          darkness: 0.3,
          offset: 0.35,
        }),
      );
    }

    if (colorEffects.length > 0) {
      composer.addPass(new EffectPass(cam, ...colorEffects));
    }

    if (isOcean && oceanDebugToggles.underwaterDistortion) {
      composer.addPass(new EffectPass(cam, new UnderwaterDistortionEffect()));
    }

    if (isOcean && enableChromaticAberration) {
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
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;
    }
  }

  $effect(() => {
    const cam = camera.current;
    // Dev A/B toggle — read so flipping it rebuilds the composer pass chain.
    const _ud = oceanDebugToggles.underwaterDistortion;
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
