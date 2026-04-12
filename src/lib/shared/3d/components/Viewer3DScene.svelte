<script lang="ts">
  /**
   * Viewer3DScene
   *
   * Inner 3D scene content for the sequence viewer. Renders inside a Threlte
   * <Canvas>. Drives avatar pose purely through the useTask sync loop — the
   * orchestrator controls currentStep and this component puppets the avatar
   * to match. avatarState.play() is never called here.
   *
   * All avatar/grid/prop/effect wiring is delegated to PerformerRig, which
   * owns the unified transform hierarchy. This component handles environment,
   * lighting, dual-wheel prop swapping, and the puppet-mode sync loop.
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import PerformerRig from "./PerformerRig.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { container } from "$lib/shared/di";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "../environments/components/Environment3D.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { Plane } from "../domain/enums/Plane";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { Raycaster, Vector2 } from "three";
  import type { Object3D, Scene } from "three";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    avatarState: AvatarInstanceState;
  }

  let { sequenceData, currentStep, isPlaying, avatarState }: Props = $props();
  // The `avatarState` prop is kept for backward-compat with Viewer3DCanvas;
  // Task 14 removes it. The scene now iterates viewer3DState.performerManager.
  void avatarState;

  const viewer3DState = getViewer3DContext();
  const { renderer, camera, scene } = useThrelte();

  // All performers from the manager — the scene renders one rig per entry.
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
    const beatIndex = Math.floor(currentStep);
    const subBeatProgress = currentStep - beatIndex;

    // Drive every performer through the same beat/sub-beat so they stay in
    // lockstep. (v1 design: all performers share the same source sequence.
    // Per-performer offsets come later.)
    for (const p of performerManager.performers) {
      if (beatIndex >= p.totalSteps) {
        p.goToStep(p.totalSteps - 1);
        p.setProgress(1);
      } else {
        p.goToStep(beatIndex);
        p.setProgress(subBeatProgress);
      }
    }

    // Drive formation transitions. transitionToFormation (called from the
    // Performers tab) kicks off an animation but doesn't run its own frame
    // loop — this tick is what actually walks positions toward the target
    // slots over the 500ms window. Without it, applyFormationFromUI flips
    // activeFormation but nothing visibly moves.
    performerManager.updateFormationTransition();
  });

  // ---------------------------------------------------------------
  // Raycasting: let users click a performer's body in 3D to select them.
  // ---------------------------------------------------------------
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
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    if (sequenceData?.intendedProp?.redPropType) return sequenceData.intendedProp.redPropType;
    if (sequenceData?.creatorIntent?.propConfig?.redPropType) return sequenceData.creatorIntent.propConfig.redPropType;
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });

  // Convert string-keyed Set from state into the typed Plane Set that Grid3D expects.
  // The state layer uses Plane enum values as strings so it doesn't need to import
  // the enum — we do the conversion here at the scene boundary.
  const gridVisiblePlanes = $derived(viewer3DState.visiblePlanes as Set<Plane>);

  // Read background type from settings for themed 3D environment
  const backgroundType = $derived.by((): BackgroundType => {
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.backgroundType ?? BackgroundType.SOLID_COLOR;
    } catch { return BackgroundType.SOLID_COLOR; }
  });

  const hasEnvironment = $derived(
    backgroundType !== BackgroundType.SOLID_COLOR &&
    backgroundType !== BackgroundType.LINEAR_GRADIENT
  );

  // Night environments need reduced default lighting since the environment provides its own
  const isNightEnvironment = $derived(
    backgroundType === BackgroundType.FIREFLY_FOREST ||
    backgroundType === BackgroundType.NIGHT_SKY ||
    backgroundType === BackgroundType.DEEP_OCEAN
  );
</script>

<!-- Environment (no STAGE_LIFT wrapper — sits at ground level) -->
{#if hasEnvironment}
  <Environment3D {backgroundType} />
{/if}

<!-- Lighting — reduced when the environment provides its own -->
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
    <PerformerRig
      position={performer.position}
      facingAngle={performer.facingAngle}
      planeMode={performer.planeMode}
      avatarState={performer}
      showGrid={viewer3DState.showGrid}
      visiblePlanes={gridVisiblePlanes}
      gridMode={(sequenceData?.gridMode ?? "diamond") as import("../domain/constants/grid-layout").GridMode}
      {bluePropType}
      {redPropType}
      bluePropState={performer.bluePropState}
      redPropState={performer.redPropState}
      tipEffectMap={globalTipEffectMap}
      {isPlaying}
      enableLocomotion={true}
      enableRootMotion={true}
      enableFootPlanting={true}
    />

    {#if viewer3DState.selectedPerformerIndex === i || viewer3DState.selectedPerformerIndex === null}
      <!-- Ground-disc selection indicator. Gray when scope is "All",
           lavender when this specific performer is selected. -->
      <T.Mesh
        position={[performer.position.x, 0.01, performer.position.z]}
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
