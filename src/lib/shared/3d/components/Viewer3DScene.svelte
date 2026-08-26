<script lang="ts">
  import { T, useTask, useThrelte, useScheduler } from "@threlte/core";
  import { layers, type ThrelteLayers } from "@threlte/extras";
  import { onMount, onDestroy } from "svelte";
  import { PerformerRig } from "@austencloud/scene-3d";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "../environments/components/Environment3D.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import SeatedAudience3D from "./SeatedAudience3D.svelte";
  import { Plane, GRID_OFFSETS, cmToUnits } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import Grid3D from "./Grid3D.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { isSeamlesslyLoopable } from "$lib/shared/foundation/services/sequence-loopability-checker";
  import { resolvePerformerProp } from "$lib/shared/3d/state/performer-prop-resolution";
  import { Raycaster, Vector2, AdditiveBlending } from "three";
  import type { Group, Object3D, Scene } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import PerformerBadge3D from "./PerformerBadge3D.svelte";
  import { getPerformerColor } from "../constants/performer-colors";
  import { attachSceneUndoKeyboard } from "../undo/scene-undo-keyboard";
  import { getSceneUndoManager } from "../undo/get-scene-undo-manager";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import AvatarSwapTransition from "./AvatarSwapTransition.svelte";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
  import type { SceneEffectsManager3D } from "../effects/scene-effects/scene-effects-manager-3d";
  import type { QualityTier } from "../effects/types";
  import { resolvePetalEnvironmentProfile } from "../effects/petals/petal-world-art-direction";
  import { resolvePerformerPlaybackStep } from "../domain/performer-step-timing";
  import {
    getStageCoordinateFrame,
    isRenderable3DEnvironment,
  } from "../environments/domain/stage-coordinate-frame";
  import { getSceneEnvironmentRendererKey } from "../environments/domain/scene-environment";
  import {
    getPerformerStageBounds,
    getPerformerStageClearance,
  } from "../environments/domain/performer-stage-bounds";
  import { tryGetEnvironmentTransitionVisualContext } from "../environments/context/environment-transition-visual-context";
  import type { EnvironmentTransitionObservation } from "../environments/domain/environment-transition";
  import {
    BASE_SCENE_LAYER,
    PROTECTED_PERFORMER_LAYER,
    protectPerformerTree,
  } from "../environments/rendering/environment-transition-compositor";

  // Performer layer membership inherits through the nested PerformerRig tree.
  layers();
  const PERFORMER_LAYERS: ThrelteLayers = [
    BASE_SCENE_LAYER,
    PROTECTED_PERFORMER_LAYER,
  ];

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    avatarState: AvatarInstanceState | null;
    /** Explicit prop-type override from the viewer's Theirs/Mine toggle.
     *  When set, takes precedence over sequenceData.intendedProp and
     *  creatorIntent.propConfig so the viewer's prop-context choice is
     *  respected in the 3D scene. Accepts string so Viewer3DCanvas can
     *  pass through without needing to import PropType. */
    bluePropTypeOverride?: string | null;
    redPropTypeOverride?: string | null;
    /** Hide grid references and performer numbers in cinematic review embeds. */
    hideSceneMarkers?: boolean;
    /** Hide performer numbers while leaving grid references available. */
    hidePerformerBadges?: boolean;
    /** Keep dictated plane grids but drop the center sphere and axis arrows,
     *  for film surfaces where planes are scenery, not editor reference. */
    hideOrientationHelpers?: boolean;
    /** Skip the effects runtime entirely in prop/model inspection surfaces. */
    enableEffects?: boolean;
    /** Stationary stage casts can skip walk, jump, and foot-planting setup. */
    enablePerformerLocomotion?: boolean;
    /** Explicit ensemble budget for the existing effect renderers. */
    effectQualityTier?: QualityTier;
    /** Per-performer count offsets, sampled against the same shared clock. */
    performerStepOffsets?: readonly number[];
    /** Reserved film rigs stay mounted, but only the active cast is rendered. */
    visiblePerformerCount?: number;
    /** Environments retained in the scene graph after the opening preparation. */
    retainedEnvironmentTypes?: readonly BackgroundType[];
    /** Lets a film-level compositor hide an atomic retained-world switch. */
    environmentTransitionVisualMode?: "internal" | "host-controlled";
    onPerformerReadinessChange?: (
      readyCount: number,
      totalCount: number
    ) => void;
    onEnvironmentTransitionChange?: (
      observation: EnvironmentTransitionObservation<BackgroundType>
    ) => void;
  }

  let {
    sequenceData,
    currentStep,
    isPlaying,
    avatarState,
    bluePropTypeOverride = null,
    redPropTypeOverride = null,
    hideSceneMarkers = false,
    hidePerformerBadges = false,
    hideOrientationHelpers = false,
    enableEffects = true,
    enablePerformerLocomotion = true,
    effectQualityTier,
    performerStepOffsets = [],
    visiblePerformerCount,
    retainedEnvironmentTypes = [],
    environmentTransitionVisualMode = "internal",
    onPerformerReadinessChange,
    onEnvironmentTransitionChange,
  }: Props = $props();
  // The scene now iterates viewer3DState.performerManager. This compatibility
  // prop can be empty while 3D Studio shows the environment before choreography.
  $effect(() => {
    void avatarState;
  });

  const viewer3DState = getViewer3DContext();
  type SettingsService =
    (typeof import("$lib/shared/settings/state/settings-state.svelte"))["settingsService"];
  let viewerSettings = $state<SettingsService | null>(null);
  const sequenceIsSeamless = $derived(
    sequenceData ? isSeamlesslyLoopable(sequenceData) : false
  );
  const sceneFeatures = getSceneFeatureContext();
  let sceneEffectsManager = $state<SceneEffectsManager3D | null>(null);
  let readyAvatarKeys = $state<Record<string, true>>({});
  const sceneEffectsCoordinatorModule = enableEffects
    ? import("../effects/scene-effects/SceneEffectsCoordinator3D.svelte")
    : null;
  const effectOrchestratorModule = enableEffects
    ? import("../effects/EffectOrchestrator3D.svelte")
    : null;
  const transitionVisual = tryGetEnvironmentTransitionVisualContext();
  const { renderer, camera, scene } = useThrelte();
  const { scheduler, resetFrameInvalidation } = useScheduler();

  function markPerformerAvatarReady(
    performerId: string,
    avatarId: string
  ): void {
    readyAvatarKeys = {
      ...readyAvatarKeys,
      [`${performerId}:${avatarId}`]: true,
    };
  }

  const performerReadiness = $derived.by(() => {
    const performers = viewer3DState.performerManager.performers.slice(
      0,
      visiblePerformerCount
    );
    return {
      readyCount: performers.filter(
        (performer) =>
          readyAvatarKeys[`${performer.id}:${performer.avatarModelId}`]
      ).length,
      totalCount: performers.length,
    };
  });

  $effect(() => {
    onPerformerReadinessChange?.(
      performerReadiness.readyCount,
      performerReadiness.totalCount
    );
  });

  // Every viewer owns its scene environment. BackgroundType remains only the
  // established renderer key below; it is no longer an application preference.
  const backgroundType = $derived(
    getSceneEnvironmentRendererKey(viewer3DState.environmentId)
  );

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
      (
        renderer as {
          setAnimationLoop(cb: ((time: number) => void) | null): void;
        }
      ).setAnimationLoop(null);
    }
  }

  function resumeAutoLoop() {
    if ("setAnimationLoop" in renderer) {
      (
        renderer as {
          setAnimationLoop(cb: ((time: number) => void) | null): void;
        }
      ).setAnimationLoop(autoLoopCallback);
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
  let globalTipEffectMap = $state<TipEffectMap>(
    visibilityManager.effectsConfigState?.tipEffectMap ?? {}
  );

  $effect(() => {
    // Sync on mount and whenever visibility settings change
    const updateMap = () => {
      globalTipEffectMap =
        visibilityManager.effectsConfigState?.tipEffectMap ?? {};
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
  useTask((delta) => {
    if (transitionVisual?.active && performerLayerRoot) {
      protectPerformerTree(performerLayerRoot);
    }
    if (transitionVisual?.active && sceneEffectsLayerRoot) {
      protectPerformerTree(sceneEffectsLayerRoot);
    }

    if (viewer3DState.selectedPerformerIndex !== null) {
      ringPulsePhase += delta * 3;
    }
    // During offline export, the exporter sets exportCurrentStep on
    // viewer3DState each frame. We read it here instead of the component
    // prop `currentStep` (which is frozen because playback is paused).
    // This keeps state distribution inside useTask - the same code path
    // as live playback - so the $derived chain (currentStepIndex →
    // bluePropState → Avatar3D props) resolves within the same frame.
    const step = viewer3DState.isExporting
      ? (viewer3DState.exportCurrentStep ?? currentStep)
      : currentStep;

    for (const [performerIndex, p] of performerManager.performers
      .slice(0, visiblePerformerCount)
      .entries()) {
      const performerStep = resolvePerformerPlaybackStep(
        step,
        performerStepOffsets[performerIndex] ?? 0,
        p.totalSteps
      );
      const performerBeat = Math.floor(performerStep);
      p.goToStep(performerBeat);
      p.setProgress(performerStep - performerBeat);
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
      const idx = (cur.userData as { performerIndex?: number } | undefined)
        ?.performerIndex;
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

  let _detachUndo: (() => void) | null = null;

  onMount(() => {
    let mounted = true;

    // Prop fallbacks still belong to app settings. Environment choice does not.
    if (!bluePropTypeOverride || !redPropTypeOverride) {
      void import("$lib/shared/settings/state/settings-state.svelte").then(
        ({ settingsService }) => {
          if (mounted) viewerSettings = settingsService;
        }
      );
    }

    if (enableEffects) {
      void import("../effects/scene-effects/scene-effects-manager-3d").then(
        ({ SceneEffectsManager3D }) => {
          if (mounted) sceneEffectsManager = new SceneEffectsManager3D();
        }
      );
    }

    _raycasterCanvas = renderer?.current?.domElement ?? null;
    if (_raycasterCanvas) {
      _raycasterCanvas.addEventListener("pointerdown", onPointerDown);

      _detachUndo = attachSceneUndoKeyboard(
        getSceneUndoManager(),
        (desc) => toast.info(`Undid: ${desc}`, 1500),
        (desc) => toast.info(`Redid: ${desc}`, 1500)
      );
    }

    return () => {
      mounted = false;
    };
  });

  onDestroy(() => {
    _raycasterCanvas?.removeEventListener("pointerdown", onPointerDown);
    _detachUndo?.();
  });

  // Resolve prop type: explicit viewer override wins, then sequence's intended
  // prop, then creator config, then global settings.
  const bluePropType = $derived.by((): PropType => {
    if (bluePropTypeOverride) return bluePropTypeOverride as PropType;
    if (sequenceData?.intendedProp?.bluePropType)
      return sequenceData.intendedProp.bluePropType;
    if (sequenceData?.creatorIntent?.propConfig?.bluePropType)
      return sequenceData.creatorIntent.propConfig.bluePropType;
    try {
      return viewerSettings?.settings?.bluePropType ?? PropType.STAFF;
    } catch {
      return PropType.STAFF;
    }
  });
  const redPropType = $derived.by((): PropType => {
    if (redPropTypeOverride) return redPropTypeOverride as PropType;
    if (sequenceData?.intendedProp?.redPropType)
      return sequenceData.intendedProp.redPropType;
    if (sequenceData?.creatorIntent?.propConfig?.redPropType)
      return sequenceData.creatorIntent.propConfig.redPropType;
    try {
      return viewerSettings?.settings?.redPropType ?? PropType.STAFF;
    } catch {
      return PropType.STAFF;
    }
  });

  const explicitPlanes = $derived(viewer3DState.visiblePlanes as Set<Plane>);

  const hasEnvironment = $derived(isRenderable3DEnvironment(backgroundType));

  const isNightEnvironment = $derived(
    backgroundType === BackgroundType.FOREST ||
      backgroundType === BackgroundType.COSMIC ||
      backgroundType === BackgroundType.OCEAN
  );

  const petalEnvironmentProfile = $derived(
    resolvePetalEnvironmentProfile(backgroundType)
  );

  const stageCoordinateFrame = $derived(
    getStageCoordinateFrame(backgroundType, sceneFeatures.isEnabled("stage"))
  );
  const stageGroundOffset = $derived(stageCoordinateFrame.performerAnchorY);

  // Keep the scene's light count stable as performers enter and leave.
  // WebGL keys material programs by light count, so one light per performer
  // forced every scene material to synchronously recompile on count changes.
  // A single movable light preserves the selected-performer highlight without
  // invalidating the shader program cache.
  const selectedPerformer = $derived.by(() => {
    const index = viewer3DState.selectedPerformerIndex;
    return index === null ? null : (performerManager.performers[index] ?? null);
  });
  const selectedPerformerLightPosition = $derived([
    selectedPerformer?.position.x ?? 0,
    stageGroundOffset + 2.5,
    (selectedPerformer?.position.z ?? 0) + 0.3,
  ] as [number, number, number]);
  const performerGroundLevel = $derived(
    userProportionsState.groundY + stageGroundOffset
  );
  const selectedPerformerRingPosition = $derived([
    selectedPerformer?.position.x ?? 0,
    performerGroundLevel + 0.015,
    selectedPerformer?.position.z ?? 0,
  ] as [number, number, number]);
  const selectedPerformerRingColor = $derived.by(() => {
    const index = viewer3DState.selectedPerformerIndex;
    return index === null
      ? 0x6b7280
      : Number.parseInt(getPerformerColor(index).slice(1), 16);
  });

  const performerCount = $derived(
    Math.min(
      performerManager.performers.length,
      visiblePerformerCount ?? performerManager.performers.length
    )
  );

  const visiblePerformers = $derived(
    performerManager.performers.slice(0, performerCount)
  );

  const stageDimensions = $derived(
    getPerformerStageBounds(
      visiblePerformers.map((performer) => performer.position),
      {
        performerClearance: getPerformerStageClearance(
          userProportionsState.avatarScale
        ),
      }
    )
  );

  const stageZOffset = $derived(stageDimensions.zOffset);

  $effect(() => {
    viewer3DState.setStageGroundOffset(stageGroundOffset);
  });

  let ringPulsePhase = $state(0);
  const ringPulse = $derived(0.6 + 0.4 * Math.sin(ringPulsePhase));
  let performerLayerRoot = $state<Group>();
  let sceneEffectsLayerRoot = $state<Group>();

  // When the background type doesn't produce a 3D environment (solid color,
  // gradient), Environment3D never mounts - so nothing will ever call
  // reportReady("environment"). Report it immediately so the curtain lifts.
  $effect(() => {
    if (!hasEnvironment && sceneFeatures.isEnabled("environment")) {
      sceneFeatures.reportReady("environment");
    }
  });
</script>

<T.Group bind:ref={sceneEffectsLayerRoot} layers={PERFORMER_LAYERS} />
{#if sceneEffectsManager && sceneEffectsCoordinatorModule}
  {#await sceneEffectsCoordinatorModule then { default: SceneEffectsCoordinator3D }}
    <SceneEffectsCoordinator3D
      manager={sceneEffectsManager}
      parent={sceneEffectsLayerRoot}
      {petalEnvironmentProfile}
    />
  {/await}
{/if}

<!-- Environment (gated by scene feature toggle) -->
{#if hasEnvironment && sceneFeatures.isEnabled("environment")}
  <Environment3D
    {backgroundType}
    {performerCount}
    stageWidth={stageDimensions.width}
    stageDepth={stageDimensions.depth}
    stageRadius={stageDimensions.radius}
    {stageZOffset}
    {retainedEnvironmentTypes}
    transitionVisualMode={environmentTransitionVisualMode}
    onTransitionChange={onEnvironmentTransitionChange}
  />
{/if}

<!-- Seated audience (gated by scene feature toggle) -->
{#if sceneFeatures.isEnabled("audience")}
  <SeatedAudience3D />
{/if}

<!-- Lighting - reduced when the environment provides its own -->
<T.AmbientLight
  intensity={isNightEnvironment ? 0.2 : hasEnvironment ? 0.3 : 0.4}
/>
<T.DirectionalLight
  position={[5, 10, 5]}
  intensity={isNightEnvironment ? 0.4 : hasEnvironment ? 0.6 : 0.8}
/>

<!-- Stable performer-only lighting for the protected transition pass. -->
<T.AmbientLight intensity={0.75} layers={PROTECTED_PERFORMER_LAYER} />
<T.DirectionalLight
  position={[-4, 9, 7]}
  intensity={1.1}
  layers={PROTECTED_PERFORMER_LAYER}
/>

<!-- Ground disc (only when no environment provides its own ground) -->
{#if !hasEnvironment}
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[2, 64]} />
    <T.MeshStandardMaterial color="#1a1a2e" />
  </T.Mesh>
{/if}

<!-- Performer group shifts with stage expansion to stay centered -->
<T.Group
  bind:ref={performerLayerRoot}
  position.z={stageZOffset}
  layers={PERFORMER_LAYERS}
>
  <T.PointLight
    position={selectedPerformerLightPosition}
    intensity={selectedPerformer ? 6 : 0}
    color={0xfff5e6}
    distance={5}
    decay={1.5}
  />

  <!-- One movable selection indicator keeps cast changes from allocating and
       uploading four hidden geometries for every performer. -->
  <T.Group
    position={selectedPerformerRingPosition}
    rotation={[-Math.PI / 2, 0, 0]}
    visible={selectedPerformer !== null}
  >
    <T.Mesh>
      <T.RingGeometry args={[0.42, 0.58, 64]} />
      <T.MeshBasicMaterial
        color={selectedPerformerRingColor}
        transparent
        opacity={ringPulse * 0.9}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </T.Mesh>
    <T.Mesh>
      <T.RingGeometry args={[0.58, 1.0, 64]} />
      <T.MeshBasicMaterial
        color={selectedPerformerRingColor}
        transparent
        opacity={ringPulse * 0.3}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </T.Mesh>
    <T.Mesh>
      <T.CircleGeometry args={[0.42, 64]} />
      <T.MeshBasicMaterial
        color={selectedPerformerRingColor}
        transparent
        opacity={0.15}
      />
    </T.Mesh>
  </T.Group>

  {#each performerManager.performers as performer, i (performer.id)}
    <T.Group userData={{ performerIndex: i }} visible={i < performerCount}>
      {@const performerGridMode = (sequenceData?.gridMode ??
        "diamond") as GridMode}
      {@const performerGridOffset = GRID_OFFSETS[performer.planeMode]}
      {@const perfStaffCm = performer.settings.staffLengthCm}
      {@const propLength =
        perfStaffCm != null ? cmToUnits(perfStaffCm) : undefined}
      <!-- Per-performer effect cascade: this performer's override, else the
         global default (effects-config wildcard). This is what makes the
         Performer Hub effect selection actually reach the renderer. -->
      {@const perfEffect =
        performer.rawEffect ?? globalTipEffectMap["*"]?.effect ?? "none"}
      {@const perfTipMap = { "*": { effect: perfEffect } }}
      {@const performerCurrentStep = resolvePerformerPlaybackStep(
        currentStep,
        performerStepOffsets[i] ?? 0,
        performer.totalSteps
      )}
      <AvatarSwapTransition
        {performer}
        performerIndex={i}
        groundOffset={stageGroundOffset}
      >
        {#snippet children({ onAvatarSwapped, avatarOpacity })}
          <PerformerRig
            position={performer.position}
            groundOffset={stageGroundOffset}
            facingAngle={performer.facingAngle}
            planeMode={performer.planeMode}
            avatarState={performer}
            avatarId={performer.avatarModelId}
            visiblePlanes={explicitPlanes}
            gridMode={performerGridMode}
            bluePropType={toScenePropType(
              resolvePerformerProp(
                performer,
                bluePropType,
                bluePropTypeOverride as PropType | null
              )
            )}
            redPropType={toScenePropType(
              resolvePerformerProp(
                performer,
                redPropType,
                redPropTypeOverride as PropType | null
              )
            )}
            bluePropState={performer.bluePropState}
            redPropState={performer.redPropState}
            tipEffectMap={perfTipMap}
            {propLength}
            isPlaying={isPlaying && i < performerCount}
            enableLocomotion={enablePerformerLocomotion}
            enableFootPlanting={enablePerformerLocomotion}
            isMoving={performer.isMoving}
            moveSpeed={performer.moveSpeed}
            moveDirection={performer.moveDirection}
            onAvatarSwapped={(avatarId) => {
              onAvatarSwapped(avatarId);
              markPerformerAvatarReady(performer.id, avatarId);
            }}
            {avatarOpacity}
          >
            {#snippet gridSlot()}
              {#if !hideSceneMarkers}
                <T.Group
                  position.z={performerGridOffset}
                  layers={BASE_SCENE_LAYER}
                >
                  <Grid3D
                    visiblePlanes={explicitPlanes}
                    gridMode={performerGridMode}
                    planeMode={performer.planeMode}
                    showLabels={viewer3DState.showGridLabels}
                    showOrientationHelpers={!hideOrientationHelpers}
                  />
                </T.Group>
              {/if}
            {/snippet}
            {#snippet effectsSlot({
              bluePropState,
              redPropState,
              blueHandPos,
              redHandPos,
              isPlaying: rigPlaying,
              staffHalfLength,
              effectsParentRef,
            })}
              {#if sceneEffectsManager && effectOrchestratorModule}
                {#await effectOrchestratorModule then { default: EffectOrchestrator3D }}
                  <EffectOrchestrator3D
                    {bluePropState}
                    {redPropState}
                    bluePropType={toScenePropType(
                      resolvePerformerProp(
                        performer,
                        bluePropType,
                        bluePropTypeOverride as PropType | null
                      )
                    )}
                    redPropType={toScenePropType(
                      resolvePerformerProp(
                        performer,
                        redPropType,
                        redPropTypeOverride as PropType | null
                      )
                    )}
                    isPlaying={rigPlaying}
                    {staffHalfLength}
                    tipEffectMap={perfTipMap}
                    {blueHandPos}
                    {redHandPos}
                    {effectsParentRef}
                    sceneEffectsManagerOverride={sceneEffectsManager}
                    qualityTierOverride={effectQualityTier}
                    currentStep={performerCurrentStep}
                    totalSteps={sequenceData?.steps.length ?? 0}
                    seamlesslyLoopable={sequenceIsSeamless}
                  />
                {/await}
              {/if}
            {/snippet}
          </PerformerRig>
        {/snippet}
      </AvatarSwapTransition>

      {#if viewer3DState.selectedPerformerIndex === null}
        <T.Mesh
          position={[
            performer.position.x,
            performerGroundLevel + 0.01,
            performer.position.z,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <T.CircleGeometry args={[0.35, 32]} />
          <T.MeshBasicMaterial color={0x6b7280} transparent opacity={0.15} />
        </T.Mesh>
      {/if}

      {#if !hideSceneMarkers && !hidePerformerBadges}
        <!-- Floating numbered badge above performer head -->
        <T.Group
          position.x={performer.position.x}
          position.y={stageGroundOffset}
          position.z={performer.position.z}
        >
          <PerformerBadge3D
            index={i}
            selected={viewer3DState.selectedPerformerIndex === i}
            allMode={viewer3DState.selectedPerformerIndex === null}
          />
        </T.Group>
      {/if}
    </T.Group>
  {/each}
</T.Group>
