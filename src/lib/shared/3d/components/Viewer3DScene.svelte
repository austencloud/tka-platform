<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { T, useTask, useThrelte, useScheduler } from "@threlte/core";
  import { onMount, onDestroy, untrack } from "svelte";
  import { PerformerRig } from "@austencloud/scene-3d";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "../environments/components/Environment3D.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import { STAGE } from "@austencloud/scene-3d";
  import SeatedAudience3D from "./SeatedAudience3D.svelte";
  import { Plane, GRID_OFFSETS, cmToUnits } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import Grid3D from "./Grid3D.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { resolvePerformerProp } from "$lib/shared/3d/state/performer-prop-resolution";
  import { Raycaster, Vector2, AdditiveBlending } from "three";
  import type { Object3D, Scene } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import PerformerBadge3D from "./PerformerBadge3D.svelte";
  import { getPerformerColor } from "../constants/performer-colors";
  import { attachSceneUndoKeyboard } from "../undo/scene-undo-keyboard";
  import { getSceneUndoManager } from "../undo/getSceneUndoManager";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import AvatarSwapTransition from "./AvatarSwapTransition.svelte";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    avatarState: AvatarInstanceState;
    /** Explicit prop-type override from the viewer's Theirs/Mine toggle.
     *  When set, takes precedence over sequenceData.intendedProp and
     *  creatorIntent.propConfig so the viewer's prop-context choice is
     *  respected in the 3D scene. Accepts string so Viewer3DCanvas can
     *  pass through without needing to import PropType. */
    bluePropTypeOverride?: string | null;
    redPropTypeOverride?: string | null;
  }

  let { sequenceData, currentStep, isPlaying, avatarState, bluePropTypeOverride = null, redPropTypeOverride = null }: Props = $props();
  // The `avatarState` prop is kept for backward-compat with Viewer3DCanvas;
  // Task 14 removes it. The scene now iterates viewer3DState.performerManager.
  $effect(() => {
    void avatarState;
  });

  const viewer3DState = getViewer3DContext();
  const sceneFeatures = getSceneFeatureContext();
  const { renderer, camera, scene } = useThrelte();
  const { scheduler, resetFrameInvalidation } = useScheduler();

  const backgroundType = $derived.by((): BackgroundType => {
    try {
      const settings = settingsService;
      return (settings as any)?.settings?.backgroundType ?? BackgroundType.COSMIC;
    } catch { return BackgroundType.COSMIC; }
  });

  function getStageGroundOffset(bg: BackgroundType): number {
    switch (bg) {
      case BackgroundType.FOREST:
      case BackgroundType.AUTUMN:
        return sceneFeatures.isEnabled("stage") ? STAGE.STAGE_DECK_HEIGHT : 0;
      case BackgroundType.COSMIC:
        return 0.4;
      case BackgroundType.WINTER:
        return 0.45;
      case BackgroundType.OCEAN:
        // 1.5 = seabed surface. With the Stage on, +1.0 (OceanStage deck rise:
        // elevation 0.5 + height 0.5) stands the performer on the ruins dais.
        return 1.5 + (sceneFeatures.isEnabled("stage") ? 1.0 : 0);
      case BackgroundType.EMBER:
        return 0.5;
      case BackgroundType.BLOSSOM:
        return 0.35;
      case BackgroundType.RAINBOW:
        return 0.4;
      case BackgroundType.CELESTIAL:
        return 0.02;
      case BackgroundType.VOID:
        return 0;
      default:
        return 0;
    }
  }

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
  let globalTipEffectMap = $state<TipEffectMap>(
    visibilityManager.effectsConfigState?.tipEffectMap ?? {}
  );

  $effect(() => {
    // Sync on mount and whenever visibility settings change
    const updateMap = () => {
      globalTipEffectMap = visibilityManager.effectsConfigState?.tipEffectMap ?? {};
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

  let _detachUndo: (() => void) | null = null;

  onMount(() => {
    _raycasterCanvas = renderer?.current?.domElement ?? null;
    if (!_raycasterCanvas) return;
    _raycasterCanvas.addEventListener("pointerdown", onPointerDown);

    _detachUndo = attachSceneUndoKeyboard(
      getSceneUndoManager(),
      (desc) => toast.info(`Undid: ${desc}`, 1500),
      (desc) => toast.info(`Redid: ${desc}`, 1500),
    );
  });

  onDestroy(() => {
    _raycasterCanvas?.removeEventListener("pointerdown", onPointerDown);
    _detachUndo?.();
  });

  // Resolve prop type: explicit viewer override wins, then sequence's intended
  // prop, then creator config, then global settings.
  const bluePropType = $derived.by((): PropType => {
    if (bluePropTypeOverride) return bluePropTypeOverride as PropType;
    if (sequenceData?.intendedProp?.bluePropType) return sequenceData.intendedProp.bluePropType;
    if (sequenceData?.creatorIntent?.propConfig?.bluePropType) return sequenceData.creatorIntent.propConfig.bluePropType;
    try {
      const settings = settingsService;
      return (settings as any)?.settings?.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    if (redPropTypeOverride) return redPropTypeOverride as PropType;
    if (sequenceData?.intendedProp?.redPropType) return sequenceData.intendedProp.redPropType;
    if (sequenceData?.creatorIntent?.propConfig?.redPropType) return sequenceData.creatorIntent.propConfig.redPropType;
    try {
      const settings = settingsService;
      return (settings as any)?.settings?.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });

  const explicitPlanes = $derived(viewer3DState.visiblePlanes as Set<Plane>);

  const hasEnvironment = $derived(
    backgroundType !== BackgroundType.VOID
  );

  const isNightEnvironment = $derived(
    backgroundType === BackgroundType.FOREST ||
    backgroundType === BackgroundType.COSMIC ||
    backgroundType === BackgroundType.OCEAN
  );

  const stageGroundOffset = $derived(getStageGroundOffset(backgroundType));

  const performerCount = $derived(performerManager.performers.length);

  const BASE_STAGE_WIDTH = 6;
  const BASE_STAGE_DEPTH = 6;
  const PERFORMER_BODY_PADDING = 1.5;

  const stageDimensions = $derived.by(() => {
    const performers = performerManager.performers;
    if (performers.length <= 1) return { width: BASE_STAGE_WIDTH, depth: BASE_STAGE_DEPTH, zOffset: 0 };

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of performers) {
      if (p.position.x < minX) minX = p.position.x;
      if (p.position.x > maxX) maxX = p.position.x;
      if (p.position.z < minZ) minZ = p.position.z;
      if (p.position.z > maxZ) maxZ = p.position.z;
    }

    const neededWidth = (maxX - minX) + PERFORMER_BODY_PADDING * 2;
    const neededDepth = (maxZ - minZ) + PERFORMER_BODY_PADDING * 2;
    const width = Math.max(BASE_STAGE_WIDTH, neededWidth);
    const depth = Math.max(BASE_STAGE_DEPTH, neededDepth);
    const zOffset = -(depth - BASE_STAGE_DEPTH) / 2;
    return { width, depth, zOffset };
  });

  const stageZOffset = $derived(stageDimensions.zOffset);

  $effect(() => {
    viewer3DState.setStageGroundOffset(stageGroundOffset);
  });

  let ringPulsePhase = $state(0);
  const ringPulse = $derived(0.6 + 0.4 * Math.sin(ringPulsePhase));


  // Reset environment readiness when the background type changes so scenes
  // that need async loading (GLB models, textures) can re-report progress.
  let prevBackgroundType = $state(untrack(() => backgroundType));
  $effect(() => {
    if (backgroundType !== prevBackgroundType) {
      sceneFeatures.resetReady("environment");
      prevBackgroundType = backgroundType;
    }
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
  <Environment3D {backgroundType} {performerCount} stageWidth={stageDimensions.width} stageDepth={stageDimensions.depth} {stageZOffset} />
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

<!-- Performer group shifts with stage expansion to stay centered -->
<T.Group position.z={stageZOffset}>
{#each performerManager.performers as performer, i (performer.id)}
  <T.Group userData={{ performerIndex: i }}>
    {@const performerGridMode = (sequenceData?.gridMode ?? "diamond") as GridMode}
    {@const performerGridOffset = GRID_OFFSETS[performer.planeMode]}
    {@const perfStaffCm = performer.settings.staffLengthCm}
    {@const propLength = perfStaffCm != null ? cmToUnits(perfStaffCm) : undefined}
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
          bluePropType={resolvePerformerProp(performer, bluePropType)}
          redPropType={resolvePerformerProp(performer, redPropType)}
          bluePropState={performer.bluePropState}
          redPropState={performer.redPropState}
          tipEffectMap={globalTipEffectMap}
          {propLength}
          {isPlaying}
          enableLocomotion={true}
          enableFootPlanting={true}
          {onAvatarSwapped}
          {avatarOpacity}
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
      {/snippet}
    </AvatarSwapTransition>

    {@const isSelected = viewer3DState.selectedPerformerIndex === i}
    {@const isAllMode = viewer3DState.selectedPerformerIndex === null}
    {@const glowColor = Number.parseInt(getPerformerColor(i).slice(1), 16)}
    {@const groundLevel = userProportionsState.groundY + stageGroundOffset}

    <T.PointLight
      position={[performer.position.x, stageGroundOffset + 2.5, performer.position.z + 0.3]}
      intensity={isSelected ? 6 : 0}
      color={0xfff5e6}
      distance={5}
      decay={1.5}
    />

    <T.Group
      position={[performer.position.x, groundLevel + 0.015, performer.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={isSelected}
    >
      <T.Mesh>
        <T.RingGeometry args={[0.42, 0.58, 64]} />
        <T.MeshBasicMaterial
          color={glowColor}
          transparent
          opacity={ringPulse * 0.9}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </T.Mesh>
      <T.Mesh>
        <T.RingGeometry args={[0.58, 1.0, 64]} />
        <T.MeshBasicMaterial
          color={glowColor}
          transparent
          opacity={ringPulse * 0.3}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </T.Mesh>
      <T.Mesh>
        <T.CircleGeometry args={[0.42, 64]} />
        <T.MeshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.15}
        />
      </T.Mesh>
    </T.Group>

    <T.Mesh
      position={[performer.position.x, userProportionsState.groundY + stageGroundOffset + 0.01, performer.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={isAllMode}
    >
      <T.CircleGeometry args={[0.35, 32]} />
      <T.MeshBasicMaterial color={0x6b7280} transparent opacity={0.15} />
    </T.Mesh>

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
  </T.Group>
{/each}
</T.Group>
