<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import {
    Color,
    FogExp2,
    type Camera,
    type Mesh,
    type Object3D,
    type Scene,
    type WebGLRenderer,
  } from "three";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { userProportionsState } from "@austencloud/scene-3d";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import Starfield from "../primitives/Starfield.svelte";
  import Stage3D from "../../components/Stage3D.svelte";
  import {
    type BlossomSceneConfig,
    createDefaultBlossomConfig,
  } from "../domain/models/scene-configs";
  import type {
    MoonConfig,
    StarfieldConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import {
    createBlossomRuntimeConfig,
    detectBlossomQuality,
  } from "./cherry-blossom/blossom-runtime";
  import BlossomLighting from "./cherry-blossom/BlossomLighting.svelte";
  import BlossomGroundDetail from "./cherry-blossom/BlossomGroundDetail.svelte";
  import BlossomGroundLife from "./cherry-blossom/BlossomGroundLife.svelte";
  import BlossomRiver from "./cherry-blossom/BlossomRiver.svelte";
  import { getBlossomActiveProductionPhase } from "./cherry-blossom/blossom-site";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";

  interface Props {
    config?: BlossomSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    /** Forwarded to the deck: practice orientation markings on or off. */
    showDirectionCues?: boolean;
  }

  let {
    config,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    showDirectionCues = true,
  }: Props = $props();

  const activeConfig = $derived(config ?? createDefaultBlossomConfig());
  const decorativeAtmosphereEnabled = getBlossomActiveProductionPhase() >= 5;
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
  const environmentScene = $derived($environmentGlb?.scene ?? null);

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
      adaptiveQuality?.contentTier ??
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
    width: activeConfig.petals.area.width * runtime.stage.atmosphereScale,
    depth: activeConfig.petals.area.depth * runtime.stage.atmosphereScale,
  });

  const distantPetalArea = $derived(
    distantPetals
      ? {
          ...distantPetals.area,
          width: distantPetals.area.width * runtime.stage.atmosphereScale,
          depth: distantPetals.area.depth * runtime.stage.atmosphereScale,
        }
      : null
  );

  const fireflyArea = $derived(
    fireflies
      ? {
          ...fireflies.area,
          width: fireflies.area.width * runtime.stage.atmosphereScale,
          depth: fireflies.area.depth * runtime.stage.atmosphereScale,
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
    currentScene.background = new Color(activeConfig.sky.topColor);

    return () => {
      if (currentScene.fog === ownedFog) currentScene.fog = null;
      currentScene.background = null;
    };
  });

  const hiddenRuntimeOwners = new Set([
    "Twilight_Backdrop",
    "Moon_Disc",
    "Stage_Base",
    "Stage_Rim",
    "Stage_Planks",
    "Stage_Feet",
  ]);

  function meshIdentity(object: Object3D): string {
    const mesh = object as Mesh;
    return `${object.name} ${mesh.geometry?.name ?? ""}`;
  }

  // Static geometry remains one authored GLB, while runtime-capable primitives
  // own the sky, stage, high-tier river, and shadows. Object visibility is
  // restored on cleanup because useGltf caches the scene between visits.
  $effect(() => {
    const root = environmentScene;
    if (!root) return;

    const visibility = new Map<Object3D, boolean>();
    root.traverse((child) => {
      visibility.set(child, child.visible);
      const identity = meshIdentity(child);
      if (hiddenRuntimeOwners.has(child.name)) child.visible = false;
      // Match the authored NODE name as well as the mesh name. GLTFLoader names
      // the Object3D after the glTF node and leaves geometry.name empty, so a
      // check against the mesh name alone never fired and the baked ribbon
      // stayed in the scene underneath the reflective pool, showing as a rim
      // wherever the two outlines disagreed.
      if (
        identity.includes("Moonlit River Mesh") ||
        identity.includes("River_Water")
      ) {
        child.visible = !runtime.effects.reflectiveWater;
      }

      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.receiveShadow =
        identity.includes("Garden Ground") ||
        identity.includes("Gravel") ||
        identity.includes("GardenEcology") ||
        identity.includes("Audience_") ||
        identity.includes("Path_") ||
        identity.includes("Operations_") ||
        identity.includes("Bridge") ||
        identity.includes("Stone") ||
        identity.includes("Boulder");
      mesh.castShadow =
        runtime.effects.shadows &&
        (identity.includes("Sakura") ||
          identity.includes("GardenEcology") ||
          identity.includes("Torii") ||
          identity.includes("Bridge") ||
          identity.includes("Lantern") ||
          identity.includes("Stone") ||
          identity.includes("Boulder"));
    });

    return () => {
      for (const [child, wasVisible] of visibility) child.visible = wasVisible;
    };
  });

  const moonConfig: MoonConfig = {
    enabled: true,
    texture: "/textures/moon.png",
    direction: [-0.42, 0.56, -0.72],
    angularDiameterDegrees: 3.6,
    opacity: 0.98,
    glowScale: 1.72,
    glowOpacity: 0.1,
    surfaceLift: 0.3,
    horizonWarmth: 0.18,
  };

  const starfieldConfig: StarfieldConfig = $derived({
    enabled: true,
    count: runtime.effects.stars,
    radius: 90,
    sizeRange: [0.9, 2.7],
    twinkleSpeed: 0.28,
    intensity: 1.72,
    magnitudeFalloff: 1.35,
    brightnessFloor: 0.52,
    horizonSpread: 0.5,
    elevationRangeDegrees: [-5, 18],
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

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
  gradientStart={0.41}
  gradientEnd={0.58}
  moon={moonConfig}
/>
<Starfield config={starfieldConfig} />

{#if !failed && environmentScene}
  <T.Group
    position={runtime.stage.position}
    scale={runtime.stage.scale}
    rotation.y={Math.PI}
    name="BlossomEnvironment"
  >
    <T is={environmentScene} />
  </T.Group>
  <BlossomGroundDetail
    scene={environmentScene}
    {stageWidth}
    {stageDepth}
    {stageZOffset}
  />
  <BlossomGroundLife
    scene={environmentScene}
    tier={qualityTier === "low" ? "base" : qualityTier}
  />
{/if}

<Stage3D
  width={stageWidth}
  depth={stageDepth}
  overrideGroundY={groundY}
  {showDirectionCues}
/>

{#if !failed && runtime.effects.reflectiveWater}
  <BlossomRiver {groundY} {stageZOffset} />
{/if}

{#if !failed && decorativeAtmosphereEnabled}
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

<BlossomLighting
  {groundY}
  {stageZOffset}
  hemisphere={activeConfig.hemisphereLight}
  moon={moonLight?.enabled ? moonLight : null}
  {runtime}
/>
