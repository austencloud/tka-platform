<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import {
    Color,
    FogExp2,
    type Camera,
    type Scene,
    type WebGLRenderer,
  } from "three";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { userProportionsState } from "@austencloud/scene-3d";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import {
    type BlossomSceneConfig,
    createDefaultBlossomConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import {
    createBlossomRuntimeConfig,
    detectBlossomQuality,
  } from "./cherry-blossom/blossom-runtime";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";

  interface Props {
    config?: BlossomSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let {
    config,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
  }: Props = $props();

  const activeConfig = $derived(config ?? createDefaultBlossomConfig());
  const distantPetals = $derived(activeConfig.distantPetals);
  const fireflies = $derived(activeConfig.fireflies);
  const moonLight = $derived(activeConfig.moonLight);
  const groundY = $derived(userProportionsState.groundY);
  const { scene, renderer, camera } = useThrelte() as unknown as {
    scene: Scene;
    renderer: WebGLRenderer;
    camera: { current: Camera };
  };
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const sceneFeatures = getSceneFeatureContext();

  const environmentGlb = useGltf("/models/blossom/blossom_environment.glb", {
    meshoptDecoder: MeshoptDecoder,
  });
  const environmentError = environmentGlb.error;

  let failed = $state(false);
  let failureReported = false;

  function reportEnvironmentFailure(
    error: unknown,
    technicalLabel: string
  ): void {
    if (failureReported) return;
    failureReported = true;
    failed = true;

    const failure = error instanceof Error ? error : new Error(String(error));
    sceneFeatures?.reportProgress("environment", 1);
    sceneFeatures?.reportReady("environment");

    if (typeof window === "undefined") return;
    getErrorHandler().showUserError({
      message: "Blossom couldn't load. Try again or choose another background.",
      technicalDetails: `${technicalLabel}: ${failure.message}`,
      error: failure,
      severity: "error",
      context: {
        module: "3d",
        tab: "blossom",
        action: "loadEnvironment",
      },
    });
  }

  function getGpuRendererName(currentRenderer: WebGLRenderer | null): string {
    if (!currentRenderer) return "";

    const gl = currentRenderer.getContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : "";
  }

  // MediaQuery touches window in its constructor, so build it lazily on the
  // client. Reading `.current` inside the derived keeps OS preference changes
  // live without a manual event-listener lifecycle.
  let reducedMotionQuery: MediaQuery | null = null;

  function prefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false;
    reducedMotionQuery ??= new MediaQuery("(prefers-reduced-motion: reduce)");
    return reducedMotionQuery.current;
  }

  const reducedMotion = $derived(prefersReducedMotion());

  const qualityTier = $derived.by(
    () =>
      adaptiveQuality?.tier ??
      detectBlossomQuality({
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        hardwareConcurrency:
          typeof navigator === "undefined"
            ? 8
            : (navigator.hardwareConcurrency ?? 4),
        gpuRenderer: getGpuRendererName(renderer),
      })
  );

  const runtime = $derived(
    createBlossomRuntimeConfig({
      tier: qualityTier,
      prefersReducedMotion: reducedMotion,
      stageWidth,
      stageDepth,
      stageZOffset,
      groundY,
      particleCounts: {
        petals: activeConfig.petals.count,
        distantPetals: distantPetals?.count ?? 0,
        fireflies: fireflies?.count ?? 0,
      },
      lightIntensities: {
        hemisphere: activeConfig.hemisphereLight.intensity,
        key: moonLight?.enabled ? moonLight.intensity : 0,
      },
    })
  );

  const petalArea = $derived({
    ...activeConfig.petals.area,
    width: activeConfig.petals.area.width * runtime.stage.horizontalScale,
    depth: activeConfig.petals.area.depth * runtime.stage.horizontalScale,
  });

  const distantPetalArea = $derived(
    distantPetals
      ? {
          ...distantPetals.area,
          width: distantPetals.area.width * runtime.stage.horizontalScale,
          depth: distantPetals.area.depth * runtime.stage.horizontalScale,
        }
      : null
  );

  const fireflyArea = $derived(
    fireflies
      ? {
          ...fireflies.area,
          width: fireflies.area.width * runtime.stage.horizontalScale,
          depth: fireflies.area.depth * runtime.stage.horizontalScale,
        }
      : null
  );

  $effect(() => {
    const currentScene = scene;

    const ownedFog = new FogExp2(
      new Color(activeConfig.fog.color),
      activeConfig.fog.density
    );
    currentScene.fog = ownedFog;

    return () => {
      if (currentScene.fog === ownedFog) currentScene.fog = null;
    };
  });

  // Match Ocean's mobile DPR cap. Blossom is now light on draw calls, but a
  // retina phone can still spend most of its frame budget filling pixels.
  $effect(() => {
    if (adaptiveQuality || typeof window === "undefined") return;
    const currentRenderer = renderer;

    const previousPixelRatio = currentRenderer.getPixelRatio();
    const nextPixelRatio = Math.min(
      window.devicePixelRatio,
      runtime.maxPixelRatio
    );
    currentRenderer.setPixelRatio(nextPixelRatio);

    return () => {
      currentRenderer.setPixelRatio(previousPixelRatio);
    };
  });

  // The loading curtain lifts only after the compressed GLB is mounted and its
  // shaders have compiled. Cancellation prevents a departed scene from
  // reporting a late ready signal into the next environment.
  $effect(() => {
    const glb = $environmentGlb;
    const loadError = $environmentError;
    const currentRenderer = renderer;
    const currentCamera = camera.current;
    const currentScene = scene;

    if (loadError) {
      reportEnvironmentFailure(loadError, "GLB load failed");
      return;
    }

    if (failureReported) return;

    if (!glb) {
      sceneFeatures?.reportProgress("environment", 0.05);
      return;
    }

    sceneFeatures?.reportProgress("environment", 0.9);
    if (!currentRenderer || !currentCamera || !currentScene) return;

    let cancelled = false;

    async function compileEnvironment() {
      await tick();
      if (cancelled) return;

      try {
        if (typeof currentRenderer.compileAsync === "function") {
          await currentRenderer.compileAsync(currentScene, currentCamera);
        } else {
          currentRenderer.compile(currentScene, currentCamera);
        }
      } catch (error) {
        if (!cancelled) {
          reportEnvironmentFailure(error, "Shader compile failed");
        }
        return;
      }

      if (cancelled) return;
      sceneFeatures?.reportProgress("environment", 1);
      sceneFeatures?.reportReady("environment");
    }

    void compileEnvironment();

    return () => {
      cancelled = true;
    };
  });
</script>

{#if failed}
  <SkyGradient
    topColor={activeConfig.sky.topColor}
    midColor={activeConfig.sky.midColor}
    bottomColor={activeConfig.sky.bottomColor}
  />
{:else if $environmentGlb}
  <T.Group
    position={runtime.stage.position}
    scale={runtime.stage.scale}
    name="BlossomEnvironment"
  >
    <T is={$environmentGlb.scene} />
  </T.Group>
{/if}

{#if !failed}
  <T.Group position.z={stageZOffset}>
    {#if runtime.particles.petals > 0}
      {#key runtime.particles.petals}
        <FallingParticles
          type={activeConfig.petals.type}
          count={runtime.particles.petals}
          area={petalArea}
          speed={activeConfig.petals.speed}
          colors={activeConfig.petals.colors}
          sizeRange={activeConfig.petals.sizeRange}
          spin={activeConfig.petals.spin}
        />
      {/key}
    {/if}

    {#if distantPetals && distantPetalArea && runtime.particles.distantPetals > 0}
      {#key runtime.particles.distantPetals}
        <FallingParticles
          type={distantPetals.type}
          count={runtime.particles.distantPetals}
          area={distantPetalArea}
          speed={distantPetals.speed}
          colors={distantPetals.colors}
          sizeRange={distantPetals.sizeRange}
          spin={distantPetals.spin}
        />
      {/key}
    {/if}

    {#if fireflies && fireflyArea && runtime.particles.fireflies > 0}
      {#key runtime.particles.fireflies}
        <FallingParticles
          type={fireflies.type}
          count={runtime.particles.fireflies}
          area={fireflyArea}
          speed={fireflies.speed}
          colors={fireflies.colors}
          sizeRange={fireflies.sizeRange}
          spin={fireflies.spin}
        />
      {/key}
    {/if}
  </T.Group>
{/if}

<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={runtime.lights.hemisphere}
/>

{#if moonLight?.enabled}
  <T.DirectionalLight
    color={moonLight.color}
    intensity={runtime.lights.key}
    position.x={moonLight.position[0]}
    position.y={moonLight.position[1]}
    position.z={moonLight.position[2] + stageZOffset}
  />
{/if}
