<script lang="ts">
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";
  import { useTask, useThrelte } from "@threlte/core";
  import {
    HalfFloatType,
    LinearFilter,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    ACESFilmicToneMapping,
    NoToneMapping,
  } from "three";
  import {
    EffectComposer,
    CopyPass,
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
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";
  import { QualityTier } from "../types";
  import { tryGetEnvironmentTransitionVisualContext } from "../../environments/context/environment-transition-visual-context";
  import { EnvironmentTransitionCompositor } from "../../environments/rendering/environment-transition-compositor";
  import {
    SCENE_COLOR_SNAPSHOT_SCALE_3D,
    clearSceneColorSnapshot3D,
    consumeSceneColorSnapshotDemand3D,
    publishSceneColorSnapshot3D,
  } from "./scene-color-snapshot-3d";

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
  const autoRender: { current: boolean; set: (v: boolean) => void } =
    _ctx.autoRender;
  const renderStage = _ctx.renderStage;
  const autoRenderTask = _ctx.autoRenderTask;
  const viewer3DState = getViewer3DContext();
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const qualityTierDetector = getQualityTierDetector();
  const transitionVisual = tryGetEnvironmentTransitionVisualContext();
  const transitionCompositor = new EnvironmentTransitionCompositor();

  const isOcean = $derived.by(() => {
    try {
      return settingsService.settings?.backgroundType === BackgroundType.OCEAN;
    } catch {
      return false;
    }
  });

  // Hardware-gated glow: on HIGH/MEDIUM the detected visual tier enables bloom, so
  // the consolidated 3D trail (HDR-emissive ribbon) blooms in ANY scene, not
  // just ocean. On LOW the trail's in-shader halo alone carries the glow and no
  // composer runs. Trails default-on in the viewer, so tier is the right gate.
  const tierConfig = $derived(
    adaptiveQuality?.config ?? qualityTierDetector.currentConfig
  );
  const tierBloom = $derived(tierConfig.enableBloom);
  // A device detected LOW at startup keeps the original composer-free budget.
  // Frame pressure may lower DPR, but it never removes authored post-processing
  // or rebuilds the composer around a cheaper visual tier mid-session.
  const allowOceanComposer = $derived(
    isOcean &&
      (adaptiveQuality
        ? adaptiveQuality.contentTier !== QualityTier.LOW
        : qualityTierDetector.currentTier !== QualityTier.LOW)
  );
  const shouldCompose = $derived(
    (allowOceanComposer || tierBloom) && !viewer3DState.isExporting
  );

  let composer: EffectComposer | null = null;
  let sceneDepthSourcePass: RenderPass | null = null;
  let lastW = 0;
  let lastH = 0;
  const _sizeVec = new Vector2();
  const sceneColorTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  sceneColorTarget.texture.name = "SceneColorSnapshot3D";
  sceneColorTarget.texture.generateMipmaps = false;
  const sceneColorCopyPass = new CopyPass(sceneColorTarget, false);
  sceneColorCopyPass.initialize(
    renderer,
    renderer.getContext().getContextAttributes()?.alpha ?? false,
    HalfFloatType
  );

  function resizeSceneColorTarget(width: number, height: number): void {
    sceneColorTarget.setSize(
      Math.max(1, Math.ceil(width * SCENE_COLOR_SNAPSHOT_SCALE_3D)),
      Math.max(1, Math.ceil(height * SCENE_COLOR_SNAPSHOT_SCALE_3D))
    );
  }

  // Water-tint live tuning (dev Water Tint slider). Base = the "1.0" look; the
  // slider scales the depth coeffs and the scatter veil proportionally, updating
  // the live effect's uniforms with no composer rebuild.
  const BASE_ABSORPTION = new Vector3(0.05, 0.018, 0.009);
  const BASE_SCATTER = new Vector3(0.0, 0.02, 0.04);
  let waterAbsorption = $state<WaterAbsorptionEffect | null>(null);
  const _tintCoeff = new Vector3();
  const _tintScatter = new Vector3();

  function buildComposer() {
    disposeComposer();

    const cam = camera.current;
    const scn = (scene as any).current ?? scene;
    if (!cam || !scn) return;

    composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
    });

    sceneDepthSourcePass = new RenderPass(scn, cam);
    sceneDepthSourcePass.needsDepthTexture = true;
    composer.addPass(sceneDepthSourcePass);

    if (isOcean) {
      renderer.shadowMap.enabled = tierConfig.enableShadows;
      // ACES, not AgX. AgX is a low-contrast, deliberately desaturating curve
      // intended to be finished with a look LUT; without one it rendered the
      // whole reef as uniform slate, which is what "the colors all seem sort
      // of washed out" was describing. ACES restores the coral warms and the
      // jellyfish cyans. Exposure matches the ocean harness so the two agree
      // on the curve and differ only by this composer's effect chain.
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }

    if (isOcean && oceanDebugToggles.waterTint) {
      // Water absorption (depth tint) only. The post-process refraction caustics
      // overlay was removed — like the god rays it read as a blurry full-screen
      // haze rather than grounded seabed light. Dev `waterTint` toggle A/Bs it,
      // the Water Tint slider scales BASE_ABSORPTION + BASE_SCATTER live.
      const s = oceanDebugToggles.waterTintStrength;
      const fx = new WaterAbsorptionEffect({
        // Beer-Lambert depth grade (R >> G >> B so red dies first), applied
        // against TRUE linearized distance (see water-absorption-effect.ts).
        absorptionR: BASE_ABSORPTION.x * s,
        absorptionG: BASE_ABSORPTION.y * s,
        absorptionB: BASE_ABSORPTION.z * s,
        scatterColor: _tintScatter.copy(BASE_SCATTER).multiplyScalar(s),
        maxDepth: 50.0,
      });
      waterAbsorption = fx;
      composer.addPass(new EffectPass(cam, fx));
    }

    const colorEffects: import("postprocessing").Effect[] = [];

    // Ocean keeps its authored bloom toggle; non-ocean scenes bloom only when
    // the quality tier allows it (HIGH/MEDIUM) so the HDR trail glows. Dev
    // `bloom` toggle A/Bs the ocean glow (it can read as a washout veil).
    const wantBloom =
      tierBloom && (isOcean ? enableBloom && oceanDebugToggles.bloom : true);
    if (wantBloom) {
      colorEffects.push(
        new BloomEffect({
          intensity: 0.8,
          luminanceThreshold: 0.6,
          luminanceSmoothing: 0.3,
          mipmapBlur: true,
          radius: 0.5,
          levels: Math.min(bloomLevels, tierConfig.bloomLevels),
          resolutionScale: Math.min(
            bloomResolutionScale,
            tierConfig.bloomResolutionScale
          ),
        })
      );
    }

    // Vignette + chromatic aberration are ocean-era polish. Keep non-ocean
    // scenes clean — they get bloom only, nothing else changes.
    if (isOcean) {
      colorEffects.push(
        new VignetteEffect({
          darkness: 0.3,
          offset: 0.35,
        })
      );
    }

    if (colorEffects.length > 0) {
      composer.addPass(new EffectPass(cam, ...colorEffects));
    }

    if (isOcean && tierBloom && oceanDebugToggles.underwaterDistortion) {
      composer.addPass(new EffectPass(cam, new UnderwaterDistortionEffect()));
    }

    if (isOcean && tierBloom && enableChromaticAberration) {
      composer.addPass(
        new EffectPass(
          cam,
          new ChromaticAberrationEffect({
            offset: new Vector2(0.0006, 0.0006),
            radialModulation: true,
            modulationOffset: 0.2,
          })
        )
      );
    }

    renderer.getSize(_sizeVec);
    const w = Math.round(_sizeVec.x);
    const h = Math.round(_sizeVec.y);
    if (w > 0 && h > 0) {
      composer.setSize(w, h);
      resizeSceneColorTarget(w, h);
    }
    lastW = w;
    lastH = h;
  }

  function disposeComposer() {
    if (composer) {
      composer.dispose();
      composer = null;
      sceneDepthSourcePass = null;
      waterAbsorption = null;
      renderer.autoClear = true;
      renderer.shadowMap.enabled = false;
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;
    }
    clearSceneColorSnapshot3D(renderer);
  }

  $effect(() => {
    const cam = camera.current;
    // Dev A/B toggles — read so flipping any of them rebuilds the composer pass
    // chain (water tint, underwater distortion, bloom are baked at build time).
    const _ud = oceanDebugToggles.underwaterDistortion;
    const _wt = oceanDebugToggles.waterTint;
    const _bloom = oceanDebugToggles.bloom;
    if (shouldCompose && cam) {
      buildComposer();
    } else {
      disposeComposer();
    }
  });

  // Live Water Tint slider — scale the running effect's coeffs + scatter without
  // rebuilding the composer. Re-runs on slider change and on every rebuild
  // (waterAbsorption is $state, reassigned in buildComposer).
  $effect(() => {
    const s = oceanDebugToggles.waterTintStrength;
    const fx = waterAbsorption;
    if (!fx) return;
    fx.absorptionCoeff = _tintCoeff.copy(BASE_ABSORPTION).multiplyScalar(s);
    fx.scatterColor = _tintScatter.copy(BASE_SCATTER).multiplyScalar(s);
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
      const cam = camera.current;
      const scn = (scene as any).current ?? scene;
      if (!cam || !scn) return;

      if (shouldCompose && composer) {
        composer.setMainCamera(cam);

        renderer.getSize(_sizeVec);
        const w = Math.round(_sizeVec.x);
        const h = Math.round(_sizeVec.y);
        if (w < 1 || h < 1) return;
        if (w !== lastW || h !== lastH) {
          composer.setSize(w, h);
          resizeSceneColorTarget(w, h);
          lastW = w;
          lastH = h;
        }

        composer.render(delta);
        if (consumeSceneColorSnapshotDemand3D(renderer)) {
          const previousRenderTarget = renderer.getRenderTarget();
          try {
            sceneColorCopyPass.render(
              renderer,
              composer.inputBuffer,
              null,
              delta,
              false
            );
          } finally {
            renderer.setRenderTarget(previousRenderTarget);
          }
          publishSceneColorSnapshot3D(renderer, {
            texture: sceneColorTarget.texture,
            depthTexture: sceneDepthSourcePass?.getDepthTexture() ?? null,
            colorSpace: composer.inputBuffer.texture.colorSpace,
          });
        } else {
          clearSceneColorSnapshot3D(renderer);
        }
      }

      transitionCompositor.render(
        renderer,
        scn,
        cam,
        transitionVisual?.opacity ?? 0
      );
    },
    { stage: renderStage, after: autoRenderTask, autoInvalidate: false }
  );

  onDestroy(() => {
    disposeComposer();
    sceneColorCopyPass.dispose();
    sceneColorTarget.dispose();
    transitionCompositor.dispose();
  });
</script>

{@render children()}
