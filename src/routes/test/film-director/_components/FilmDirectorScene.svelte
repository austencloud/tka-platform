<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";

  import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { setSceneFeatureContext } from "$lib/shared/3d/scene-features/context/scene-feature-context";
  import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { resolveFilmDirectorEffectQualityTier } from "../_lib/film-director-performance-policy";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import demoSequenceJson from "$lib/shared/landing/data/demo-sequence.json";

  import { getFilmDirectorContext } from "../_lib/film-director-context";
  import {
    applyDirectorCameraFrame,
    applyDirectorEffectPresets,
    applyDirectorShotToViewer,
    buildDirectorViewerSeed,
  } from "../_lib/director-viewer-adapter";
  import { getPreviewCameraFov } from "../_lib/director-camera-track";
  import { createFilmDirectorTransitionProfiler } from "../_lib/film-director-transition-profiler.svelte";
  import { createFilmDirectorWarmupPlan } from "../_lib/film-director-warmup-plan";
  import { getSceneEnvironmentRendererKey } from "$lib/shared/3d/environments/domain/scene-environment";
  import type { EnvironmentTransitionObservation } from "$lib/shared/3d/environments/domain/environment-transition";
  import type { BackgroundType } from "@austencloud/backgrounds";
  import type { ResolvedDirectorShot } from "../_lib/film-director-schema";

  const director = getFilmDirectorContext();
  const sequence = demoSequenceJson as unknown as SequenceData;
  const firstShot = director.film.shots[0]!;
  const reservedPerformerCount = $derived(
    Math.max(
      ...director.film.shots.map((shot) => shot.performance.performers.length)
    )
  );
  const retainedEnvironmentTypes = $derived(
    Array.from(
      new Set(
        director.film.shots.map((shot) =>
          getSceneEnvironmentRendererKey(shot.scene.environmentId)
        )
      )
    )
  );
  const sceneFeatures = createSceneFeatureState(firstShot.scene.sceneFeatures, {
    isolated: true,
  });
  const effectsConfig = createEffectsConfigState(undefined, { persist: false });
  const viewer = createViewer3DState(buildDirectorViewerSeed(firstShot));
  const transitionProfiler = createFilmDirectorTransitionProfiler();

  setSceneFeatureContext(sceneFeatures);
  setEffectsConfigContext(effectsConfig);
  setViewer3DContext(viewer);
  viewer.enter3D(sequence);
  viewer.hideAllPlanes();

  let appliedShotId = "";
  let warmupCursor = $state(0);
  let acknowledgedWarmupCursor = $state(-1);
  let initialSceneReady = $state(false);
  let latestEnvironmentTransition =
    $state<EnvironmentTransitionObservation<BackgroundType> | null>(null);
  let snapshotCanvas: HTMLCanvasElement;
  let snapshotVisible = $state(false);
  let snapshotFading = $state(false);
  let snapshotOpacity = $state(0);
  let snapshotDurationMs = $state(0);
  let activeTransitionToken = 0;
  let observedPreparationRevision = director.preparationRevision;
  let sceneElement: HTMLDivElement;
  let viewportAspectRatio = $state(
    director.film.format.width / director.film.format.height
  );
  const warmupPlan = $derived(
    createFilmDirectorWarmupPlan(director.film.shots.length)
  );
  const presentedShot = $derived(
    director.preparation.complete
      ? director.frame.shot
      : director.film.shots[warmupPlan[warmupCursor] ?? 0]!
  );
  const presentedStepOffsets = $derived(
    director.preparation.complete
      ? director.frame.performerStepOffsets
      : presentedShot.performance.performers.map(
          (performer) => performer.beatOffset
        )
  );
  const previewCameraFov = $derived(
    getPreviewCameraFov(
      director.frame.camera.fovDeg,
      director.film.format.width / director.film.format.height,
      viewportAspectRatio
    )
  );
  const effectQualityTier = $derived(
    resolveFilmDirectorEffectQualityTier(
      presentedShot.performance.performers.length
    )
  );

  function tryAdvanceWarmup(): void {
    if (director.preparation.complete || !initialSceneReady) return;
    if (acknowledgedWarmupCursor === warmupCursor) return;

    const transition = latestEnvironmentTransition;
    const expectedEnvironment = getSceneEnvironmentRendererKey(
      presentedShot.scene.environmentId
    );
    if (
      !transition?.settled ||
      transition.mountedKey !== expectedEnvironment ||
      transition.requestedKey !== expectedEnvironment
    ) {
      return;
    }

    acknowledgedWarmupCursor = warmupCursor;
    if (warmupCursor >= warmupPlan.length - 1) {
      director.completePreparation();
      director.setSceneReady(true);
      return;
    }

    warmupCursor += 1;
    const nextShotIndex = warmupPlan[warmupCursor] ?? 0;
    director.setPreparationShot(
      nextShotIndex,
      Math.min(warmupCursor, director.preparation.totalSteps)
    );
  }

  function handleSceneReadyChange(ready: boolean): void {
    if (!ready) return;
    initialSceneReady = true;
    tryAdvanceWarmup();
  }

  function handleEnvironmentTransition(
    observation: EnvironmentTransitionObservation<BackgroundType>
  ): void {
    latestEnvironmentTransition = observation;
    transitionProfiler.observe(observation);
    tryAdvanceWarmup();
  }

  const afterPaint = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  function capturePresentedFrame(): boolean {
    const source = viewer.webglCanvas;
    if (!source || !snapshotCanvas) return false;

    snapshotCanvas.width = source.width;
    snapshotCanvas.height = source.height;
    const context = snapshotCanvas.getContext("2d", { alpha: false });
    if (!context) return false;

    context.drawImage(source, 0, 0, source.width, source.height);
    return true;
  }

  function applyShot(shot: ResolvedDirectorShot): void {
    appliedShotId = shot.id;

    for (const [feature, enabled] of Object.entries(shot.scene.sceneFeatures)) {
      if (sceneFeatures.isEnabled(feature) !== enabled)
        sceneFeatures.toggle(feature);
    }
    applyDirectorShotToViewer(viewer, shot, { reservedPerformerCount });
    applyDirectorEffectPresets(effectsConfig, shot);
  }

  async function waitForIncomingFrame(
    token: number,
    shot: ResolvedDirectorShot
  ): Promise<boolean> {
    const expectedEnvironment = getSceneEnvironmentRendererKey(
      shot.scene.environmentId
    );
    const startedAt = performance.now();

    while (token === activeTransitionToken) {
      const observation = latestEnvironmentTransition;
      if (
        observation?.settled &&
        observation.mountedKey === expectedEnvironment &&
        observation.requestedKey === expectedEnvironment
      ) {
        // A ready signal may land in the same update that activates the world.
        // Keep the outgoing frame opaque until the complete incoming
        // composition has survived two actual paints.
        await tick();
        await afterPaint();
        await afterPaint();
        return token === activeTransitionToken;
      }

      if (performance.now() - startedAt > 60_000) {
        console.error(
          `[FilmDirector] Incoming shot "${shot.id}" did not produce a settled frame within 60 seconds.`
        );
        return token === activeTransitionToken;
      }
      await afterPaint();
    }

    return false;
  }

  async function beginShotTransition(
    shot: ResolvedDirectorShot
  ): Promise<void> {
    const token = ++activeTransitionToken;
    const transition = shot.transition;
    const previousShot = director.film.shots.find(
      (candidate) => candidate.id === appliedShotId
    );
    const timelineBlackIsOpaque =
      transition.kind === "fade-through-black" &&
      director.frame.fadeOpacity >= 0.98;
    const needsSnapshot = !timelineBlackIsOpaque;

    snapshotFading = false;
    snapshotOpacity = needsSnapshot && capturePresentedFrame() ? 1 : 0;
    snapshotVisible = snapshotOpacity === 1;
    snapshotDurationMs = Math.max(0, transition.durationSeconds * 1000);
    latestEnvironmentTransition = null;
    director.setTransitionHolding(true);

    if (snapshotVisible) {
      // Commit the complete outgoing frame to the screen before any scene,
      // cast, effect, or post-processing state changes. Expensive work then
      // happens behind pixels the browser has already presented instead of
      // lengthening the last live frame at the cut.
      await tick();
      await afterPaint();
      if (token !== activeTransitionToken) return;
    }

    transitionProfiler.beginHostTransition(
      previousShot
        ? getSceneEnvironmentRendererKey(previousShot.scene.environmentId)
        : null,
      getSceneEnvironmentRendererKey(shot.scene.environmentId)
    );
    applyShot(shot);

    if (!(await waitForIncomingFrame(token, shot))) return;

    // The black overlay is already fully opaque at a fade-through-black shot
    // boundary. Releasing the held playhead lowers that same overlay over the
    // prepared incoming frame; no environment veil participates.
    if (timelineBlackIsOpaque) {
      director.setTransitionHolding(false);
      return;
    }

    director.setTransitionHolding(false);
    if (!snapshotVisible || snapshotDurationMs === 0) {
      snapshotVisible = false;
      snapshotOpacity = 0;
      return;
    }

    snapshotFading = true;
    await afterPaint();
    if (token !== activeTransitionToken) return;
    snapshotOpacity = 0;

    await new Promise<void>((resolve) =>
      window.setTimeout(resolve, snapshotDurationMs + 80)
    );
    if (token !== activeTransitionToken) return;
    snapshotVisible = false;
    snapshotFading = false;
  }

  onMount(() => {
    transitionProfiler.start();
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.height <= 0) return;
      viewportAspectRatio = entry.contentRect.width / entry.contentRect.height;
    });
    observer.observe(sceneElement);
    return () => {
      observer.disconnect();
      transitionProfiler.destroy();
    };
  });

  $effect(() => {
    const preparationRevision = director.preparationRevision;
    if (preparationRevision !== observedPreparationRevision) {
      observedPreparationRevision = preparationRevision;
      warmupCursor = 0;
      acknowledgedWarmupCursor = -1;
      latestEnvironmentTransition = null;
      activeTransitionToken += 1;
      snapshotVisible = false;
      snapshotFading = false;
      snapshotOpacity = 0;
      director.setTransitionHolding(false);
      director.setPreparationShot(0);
    }

    const shot = presentedShot;
    if (shot.id === appliedShotId) return;
    if (!director.preparation.complete || appliedShotId === "") {
      applyShot(shot);
      return;
    }

    void beginShotTransition(shot);
  });

  $effect(() => {
    const camera = director.frame.camera;
    director.sceneReady;
    applyDirectorCameraFrame(viewer, camera, previewCameraFov);
  });

  onDestroy(() => {
    activeTransitionToken += 1;
    director.setTransitionHolding(false);
    viewer.dispose();
  });
</script>

<div
  bind:this={sceneElement}
  class="director-scene"
  data-director-shot={director.frame.shot.id}
  data-director-scene-ready={director.sceneReady}
  aria-hidden="true"
>
  <Viewer3DCanvas
    sequenceData={sequence}
    currentStep={director.preparation.complete
      ? director.frame.sequenceStep
      : 0}
    isPlaying={director.isPlaying}
    bpm={presentedShot.performance.bpm}
    hideOverlays={true}
    hideSceneMarkers={true}
    hidePerformerBadges={true}
    fullScreen={true}
    enableEffects={true}
    enablePerformerLocomotion={false}
    {effectQualityTier}
    waitForPerformersOnInitialReveal={true}
    performerStepOffsets={presentedStepOffsets}
    visiblePerformerCount={presentedShot.performance.performers.length}
    {retainedEnvironmentTypes}
    environmentTransitionVisualMode="host-controlled"
    sceneLoadTimeoutMs={60_000}
    onSceneReadyChange={handleSceneReadyChange}
    onEnvironmentTransitionChange={handleEnvironmentTransition}
  />
  <canvas
    bind:this={snapshotCanvas}
    class="shot-snapshot"
    class:visible={snapshotVisible}
    class:fading={snapshotFading}
    style:opacity={snapshotOpacity}
    style:--shot-dissolve-duration={`${snapshotDurationMs}ms`}
    aria-hidden="true"
  ></canvas>
  <div
    class="editorial-fade"
    style:opacity={director.frame.fadeOpacity}
    aria-hidden="true"
  ></div>
</div>

<style>
  .director-scene {
    position: absolute;
    inset: 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: #070812;
  }

  .editorial-fade {
    position: absolute;
    inset: 0;
    z-index: 40;
    background: #020206;
    pointer-events: none;
  }

  .shot-snapshot {
    position: absolute;
    inset: 0;
    z-index: 39;
    width: 100%;
    height: 100%;
    visibility: hidden;
    pointer-events: none;
  }

  .shot-snapshot.visible {
    visibility: visible;
  }

  .shot-snapshot.fading {
    transition: opacity var(--shot-dissolve-duration) linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .editorial-fade,
    .shot-snapshot.fading {
      transition: none;
    }
  }
</style>
