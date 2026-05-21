<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { T, useTask, useThrelte, useScheduler } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import { PerformerRig } from "@austencloud/scene-3d";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "../environments/components/Environment3D.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import { STAGE } from "@austencloud/scene-3d";
  import Stage3D from "./Stage3D.svelte";
  import SeatedAudience3D from "./SeatedAudience3D.svelte";
  import { Plane, GRID_OFFSETS, cmToUnits } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import Grid3D from "./Grid3D.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { resolvePerformerProp } from "$lib/shared/3d/state/performer-prop-resolution";
  import { Raycaster, Vector2 } from "three";
  import type { Object3D, Scene } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    avatarState: AvatarInstanceState;
  }

  let { sequenceData, currentStep, isPlaying, avatarState }: Props = $props();
  // The `avatarState` prop is kept for backward-compat with Viewer3DCanvas;
  // Task 14 removes it. The scene now iterates viewer3DState.performerManager.
  $effect(() => {
    void avatarState;
  });

  const viewer3DState = getViewer3DContext();
  const sceneFeatures = getSceneFeatureContext();
  const { renderer, camera, scene } = useThrelte();
  const { scheduler, resetFrameInvalidation } = useScheduler();

  const COSMIC_PLATFORM_HEIGHT = 0.4;

  const backgroundType = $derived.by((): BackgroundType => {
    try {
      const settings = settingsService;
      return (settings as any)?.settings?.backgroundType ?? BackgroundType.SOLID_COLOR;
    } catch { return BackgroundType.SOLID_COLOR; }
  });

  const hasOwnPlatform = $derived(backgroundType === BackgroundType.NIGHT_SKY);

  // Reconstructs Threlte's default setAnimationLoop callback. We restore
  // this after the offline export pauses the loop.
  const autoLoopCallback = (time: number) => {
    scheduler.run(time);
    resetFrameInvalidation();
  };

  // runFrame drives Threlte's entire pipeline synchronously in one call:
  // every registered useTask (puppet loop, IK, effects, autoRender) runs,
  // then the scene is drawn to the canvas. No rAF involved. The exporter
  // uses this to export at CPU speed (decoupled from display refresh rate)
  // and without tab-switch throttling.
  function runFrame(timeMs: number) {
    scheduler.run(timeMs);
    resetFrameInvalidation();
  }

  // During export the native rAF loop is paused so it doesn't fight our
  // manual pacing. Resume restores the identical callback Threlte set up.
  function pauseAutoLoop() {
    if ("setAnimationLoop" in renderer) {
      (renderer as { setAnimationLoop(cb: ((time: number) => void) | null): void })
        .setAnimationLoop(null);
    }
  }

  function resumeAutoLoop() {
    if ("setAnimationLoop" in renderer) {
      (renderer as { setAnimationLoop(cb: ((time: number) => void) | null): void })
        .setAnimationLoop(autoLoopCallback);
    }
  }

  // Register Threlte internals so the offline exporter can drive the full
  // render pipeline. Threlte exposes renderer and scene as direct objects
  // (not CurrentWritable), but camera is a CurrentWritable with .current.
  $effect(() => {
    const cam = camera.current;
    if (renderer && scene && cam) {
      viewer3DState.registerThrelteInternals({
        renderer,
        scene,
        camera: cam,
        runFrame,
        pauseAutoLoop,
        resumeAutoLoop,
      });
    }
  });

  // All performers from the manager - the scene renders one rig per entry.
  const performerManager = $derived(viewer3DState.performerManager);

  // Read the global tip effect map so the 3D orchestrator knows which effect
  // each tip should use (trails, led, fire, etc.).
  // The visibility manager uses an observer pattern (not Svelte runes), so we
  // bridge it into reactive state with $state + registerObserver.
  const visibilityManager = getAnimationVisibilityManager();
  let globalTipEffectMap = $state<TipEffectMap>(visibilityManager.getTipEffectMap());

  $effect(() => {
    // Sync on mount and whenever visibility settings change
    const updateMap = () => {
      globalTipEffectMap = visibilityManager.getTipEffectMap();
    };
    visibilityManager.registerObserver(updateMap);
    updateMap();
    return () => visibilityManager.unregisterObserver(updateMap);
  });

  // Puppet-mode sync loop: convert the orchestrator's floating-point currentStep
  // into avatar beat index + sub-beat progress each frame.
  //
  // currentStep is a continuous float: integer part = beat index, fractional
  // part = sub-beat interpolation 0..1. Beat 0 = start position, beats 1+ = motion.
  //
  // stepConfigs now includes the start position at index 0, so the mapping
  // is direct: 2D beat N → 3D index N (no offset needed).
  useTask(() => {
    // During offline export, the exporter sets exportCurrentStep on
    // viewer3DState each frame. We read it here instead of the component
    // prop `currentStep` (which is frozen because playback is paused).
    // This keeps state distribution inside useTask - the same code path
    // as live playback - so the $derived chain (currentStepIndex →
    // bluePropState → Avatar3D props) resolves within the same frame.
    const step = viewer3DState.isExporting
      ? viewer3DState.exportCurrentStep ?? currentStep
      : currentStep;

    const stepNumber = Math.floor(step);
    const subBeatProgress = step - stepNumber;

    for (const p of performerManager.performers) {
      const wrappedBeat = p.totalSteps > 0 && stepNumber >= p.totalSteps
        ? stepNumber % p.totalSteps
        : stepNumber;
      p.goToStep(wrappedBeat);
      p.setProgress(subBeatProgress);
    }

    // Drive formation transitions. transitionToFormation (called from the
    // Performers tab) kicks off an animation but doesn't run its own frame
    // loop - this tick is what actually walks positions toward the target
    // slots over the 500ms window. Without it, applyFormationFromUI flips
    // activeFormation but nothing visibly moves.
    if (!viewer3DState.isExporting) {
      performerManager.updateFormationTransition();
    }
  });

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  /**
   * Convert a DOM pointer event into normalized device coordinates (-1..1),
   * matching the canvas the renderer is drawing into.
   */
  function setPointerFromEvent(e: PointerEvent): void {
    const canvas = _raycasterCanvas ?? renderer?.current?.domElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Walk up the parent chain of a hit Object3D looking for a node whose
   * `userData.performerIndex` is set by the iteration template below.
   * Returns the performer index or null.
   */
  function findPerformerIndexFromHit(obj: Object3D | null): number | null {
    let cur: Object3D | null = obj;
    while (cur) {
      const idx = (cur.userData as { performerIndex?: number } | undefined)?.performerIndex;
      if (typeof idx === "number") return idx;
      cur = cur.parent;
    }
    return null;
  }

  /**
   * Hit-test the whole scene, then resolve the first performer hit. Returns
   * the performer index that was hit, or null for empty-space / non-performer.
   */
  function hitTestPerformers(e: PointerEvent): number | null {
    const activeCamera = camera.current;
    if (!activeCamera) return null;
    const sceneRoot: Scene | null = scene.current ?? null;
    if (!sceneRoot) return null;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, activeCamera);
    const hits = raycaster.intersectObjects(sceneRoot.children, true);

    for (const hit of hits) {
      const idx = findPerformerIndexFromHit(hit.object);
      if (idx !== null) return idx;
    }
    return null;
  }

  // Attach the pointerdown listener to the renderer's DOM canvas. Suppress
  // clicks during camera orbit so ending a drag doesn't steal the selection.
  // Uses onMount/onDestroy (same pattern as ManualRaycaster) since
  // renderer.current is available at mount time, not as a reactive binding.
  let _raycasterCanvas: HTMLCanvasElement | null = null;

  function onPointerDown(e: PointerEvent): void {
    if (viewer3DState.isCameraDragging) return;
    const idx = hitTestPerformers(e);
    viewer3DState.selectPerformerScope(idx);
  }

  onMount(() => {
    _raycasterCanvas = renderer?.current?.domElement ?? null;
    if (!_raycasterCanvas) return;
    _raycasterCanvas.addEventListener("pointerdown", onPointerDown);
  });

  onDestroy(() => {
    _raycasterCanvas?.removeEventListener("pointerdown", onPointerDown);
  });

  // Resolve prop type: prefer sequence's intended prop, fall back to settings
  const bluePropType = $derived.by((): PropType => {
    if (sequenceData?.intendedProp?.bluePropType) return sequenceData.intendedProp.bluePropType;
    if (sequenceData?.creatorIntent?.propConfig?.bluePropType) return sequenceData.creatorIntent.propConfig.bluePropType;
    try {
      const settings = settingsService;
      return (settings as any)?.settings?.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    if (sequenceData?.intendedProp?.redPropType) return sequenceData.intendedProp.redPropType;
    if (sequenceData?.creatorIntent?.propConfig?.redPropType) return sequenceData.creatorIntent.propConfig.redPropType;
    try {
      const settings = settingsService;
      return (settings as any)?.settings?.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });

  const explicitPlanes = $derived(viewer3DState.visiblePlanes as Set<Plane>);

  const hasEnvironment = $derived(
    backgroundType !== BackgroundType.SOLID_COLOR &&
    backgroundType !== BackgroundType.LINEAR_GRADIENT
  );

  const isNightEnvironment = $derived(
    backgroundType === BackgroundType.FIREFLY_FOREST ||
    backgroundType === BackgroundType.NIGHT_SKY ||
    backgroundType === BackgroundType.DEEP_OCEAN
  );

  const stageGroundOffset = $derived(
    hasOwnPlatform
      ? COSMIC_PLATFORM_HEIGHT
      : sceneFeatures.isEnabled("stage") ? STAGE.STAGE_DECK_HEIGHT : 0
  );

  const PERFORMER_BODY_PADDING = 1.5;

  const requiredStageRadius = $derived.by(() => {
    const performers = performerManager.performers;
    if (performers.length <= 1) return 0;
    let maxDist = 0;
    for (const p of performers) {
      const dist = Math.sqrt(p.position.x ** 2 + p.position.z ** 2);
      maxDist = Math.max(maxDist, dist);
    }
    return maxDist + PERFORMER_BODY_PADDING;
  });

  const stageWidth = $derived(Math.max(6.0, requiredStageRadius * 2));
  const stageDepth = $derived(Math.max(4.5, requiredStageRadius * 2));
  $effect(() => {
    viewer3DState.setStageGroundOffset(stageGroundOffset);
  });

  // When the background type doesn't produce a 3D environment (solid color,
  // gradient), Environment3D never mounts - so nothing will ever call
  // reportReady("environment"). Report it immediately so the curtain lifts.
  $effect(() => {
    if (!hasEnvironment && sceneFeatures.isEnabled("environment")) {
      sceneFeatures.reportReady("environment");
    }
  });
</script>

<!-- Environment (gated by scene feature toggle) -->
{#if hasEnvironment && sceneFeatures.isEnabled("environment")}
  <Environment3D {backgroundType} minPlatformRadius={requiredStageRadius} oceanVariant={viewer3DState.oceanVariant} />
{/if}

{#if sceneFeatures.isEnabled("stage") && !hasOwnPlatform}
  <Stage3D width={stageWidth} depth={stageDepth} />
{/if}

<!-- Seated audience (gated by scene feature toggle) -->
{#if sceneFeatures.isEnabled("audience")}
  <SeatedAudience3D />
{/if}

<!-- Lighting - reduced when the environment provides its own -->
<T.AmbientLight intensity={isNightEnvironment ? 0.2 : hasEnvironment ? 0.3 : 0.4} />
<T.DirectionalLight position={[5, 10, 5]} intensity={isNightEnvironment ? 0.4 : hasEnvironment ? 0.6 : 0.8} />

<!-- Ground disc (only when no environment provides its own ground) -->
{#if !hasEnvironment}
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[2, 64]} />
    <T.MeshStandardMaterial color="#1a1a2e" />
  </T.Mesh>
{/if}

<!-- One PerformerRig per performer. Each group is tagged with userData.performerIndex
     so the scene raycaster can resolve which performer was clicked. -->
{#each performerManager.performers as performer, i (performer.id)}
  <T.Group userData={{ performerIndex: i }}>
    {@const performerGridMode = (sequenceData?.gridMode ?? "diamond") as GridMode}
    {@const performerGridOffset = GRID_OFFSETS[performer.planeMode]}
    {@const perfStaffCm = performer.settings.staffLengthCm}
    {@const propLength = perfStaffCm != null ? cmToUnits(perfStaffCm) : undefined}
    <PerformerRig
      position={performer.position}
      groundOffset={stageGroundOffset}
      facingAngle={performer.facingAngle}
      planeMode={performer.planeMode}
      avatarState={performer}
      visiblePlanes={explicitPlanes}
      gridMode={performerGridMode}
      bluePropType={resolvePerformerProp(performer, bluePropType)}
      redPropType={resolvePerformerProp(performer, redPropType)}
      bluePropState={performer.bluePropState}
      redPropState={performer.redPropState}
      tipEffectMap={globalTipEffectMap}
      {propLength}
      {isPlaying}
      enableLocomotion={true}
      enableFootPlanting={true}
    >
      {#snippet gridSlot()}
        <T.Group position.z={performerGridOffset}>
          <Grid3D
            visiblePlanes={explicitPlanes}
            gridMode={performerGridMode}
            showLabels={viewer3DState.showGridLabels}
          />
        </T.Group>
      {/snippet}
    </PerformerRig>

    {#if viewer3DState.selectedPerformerIndex === i || viewer3DState.selectedPerformerIndex === null}
      <!-- Ground-disc selection indicator. Gray when scope is "All",
           lavender when this specific performer is selected. -->
      <T.Mesh
        position={[performer.position.x, userProportionsState.groundY + stageGroundOffset + 0.01, performer.position.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <T.CircleGeometry args={[0.45, 32]} />
        <T.MeshBasicMaterial
          color={viewer3DState.selectedPerformerIndex === null ? 0x6b7280 : 0x8b8bff}
          transparent
          opacity={0.35}
        />
      </T.Mesh>
    {/if}
  </T.Group>
{/each}
