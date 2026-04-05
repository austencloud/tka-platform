<script lang="ts">
  /**
   * Viewer3DScene
   *
   * Inner 3D scene content for the sequence viewer. Renders inside a Threlte
   * <Canvas>. Drives avatar pose purely through the useTask sync loop — the
   * orchestrator controls currentStep and this component puppets the avatar
   * to match. avatarState.play() is never called here.
   */

  import { T, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import { calculatePropQuaternion } from "../domain/constants/plane-transforms";
  import Avatar3D from "./Avatar3D.svelte";
  import Prop3D from "./props/Prop3D.svelte";
  import Grid3D from "./Grid3D.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { container } from "$lib/shared/di";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "../environments/components/Environment3D.svelte";
  import EffectOrchestrator3D from "../effects/EffectOrchestrator3D.svelte";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { Plane } from "../domain/enums/Plane";
  import { PlaneMode } from "../domain/enums/PlaneMode";
  import { PLANE_MODE_CONFIGS, GRID_OFFSETS } from "../domain/constants/plane-mode-configs";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { PropState3D } from "../domain/models/PropState3D";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    avatarState: AvatarInstanceState;
  }

  let { sequenceData, currentStep, isPlaying, avatarState }: Props = $props();
  const viewer3DState = getViewer3DContext();

  // Avatar3D.position.y serves two purposes: IK target math AND visual placement.
  // groundY is ~-1.56 (where the avatar's feet naturally sit). We set position.y
  // to STAGE_LIFT so IK math is correct, then wrap in a Group at -STAGE_LIFT to
  // push the visual model down so feet land at y=0. Same pattern as MuseumPerformerStation3D.
  const STAGE_LIFT = $derived(-userProportionsState.groundY);
  const avatarPosition = $derived({ x: 0, y: STAGE_LIFT, z: 0 });
  // GLTF models face -Z at facingAngle=0 (OpenGL convention).
  // Camera at +Z looks toward -Z and sees the avatar's back.
  // From +Z looking -Z (right-handed): +X = screen right = east ✓
  // In dual wheel mode, the avatar turns 90° — read from avatar state.
  const facingAngle = $derived(avatarState.facingAngle);

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
  let _diagOnce = false;
  useTask(() => {
    const beatIndex = Math.floor(currentStep);
    const subBeatProgress = currentStep - beatIndex;
    avatarState.goToStep(beatIndex);
    avatarState.setProgress(subBeatProgress);

    if (!_diagOnce && avatarState.bluePropState) {
      _diagOnce = true;
      const b = avatarState.bluePropState;
      const r = avatarState.redPropState;
      console.log(`[DIAG:Scene] currentStep=${currentStep.toFixed(2)} beatIndex=${beatIndex}`);
      console.log(`[DIAG:Scene] blue worldPos: x=${b.worldPosition.x.toFixed(3)} y=${b.worldPosition.y.toFixed(3)}`);
      if (r) console.log(`[DIAG:Scene] red worldPos: x=${r.worldPosition.x.toFixed(3)} y=${r.worldPosition.y.toFixed(3)}`);
      console.log(`[DIAG:Scene] blue staffAngle=${b.staffRotationAngle.toFixed(3)} centerPath=${b.centerPathAngle.toFixed(3)}`);
    }
  });

  // Mirror mode: swap blue↔red AND mirror X positions so the performer
  // appears to do the same visual shapes from the front (face to face).
  // Your red = their red, your left = their right.
  const isMirror = $derived(viewer3DState.mirrorMode);

  function mirrorPropState(state: PropState3D | null): PropState3D | null {
    if (!state) return null;
    // Mirror X position (east↔west)
    const mirroredPos = new Vector3(-state.worldPosition.x, state.worldPosition.y, state.worldPosition.z);
    // Mirror the staff rotation: π - angle preserves IN/OUT orientation
    // (the offset from center path) while reversing the rotation direction
    // (CW↔CCW). This is because reflecting across the Y axis in the wall
    // plane maps angle θ to π - θ.
    const mirroredAngle = Math.PI - state.staffRotationAngle;
    const mirroredRot = calculatePropQuaternion(state.plane, mirroredAngle);
    return { ...state, worldPosition: mirroredPos, worldRotation: mirroredRot, staffRotationAngle: mirroredAngle };
  }

  const rawBlue = $derived(avatarState.bluePropState);
  const rawRed = $derived(avatarState.redPropState);

  // In mirror mode: swap hands AND mirror positions
  const bluePropState = $derived(isMirror ? mirrorPropState(rawRed) : rawBlue);
  const redPropState = $derived(isMirror ? mirrorPropState(rawBlue) : rawRed);

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
  const propGridOffset = $derived(GRID_OFFSETS[avatarState.planeMode]);

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

<!-- 3D Environment (sky, ground, particles - matches user's theme).
     The environment positions everything at groundY (≈ -1.56m) but the viewer
     lifts the avatar so feet land at y=0. Shift the environment up to match. -->
{#if hasEnvironment}
  <T.Group position.y={STAGE_LIFT}>
    <Environment3D {backgroundType} />
  </T.Group>
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

<!-- Grid planes (wall/wheel/floor discs) — toggled via viewer state.
     centerPosition matches avatarPosition so the grid is at shoulder height
     where the props actually rotate, not at ground level.
     In dual wheel mode, we render two grids offset laterally (one per hand). -->
{#if viewer3DState.showGrid}
  {@const currentPlaneMode = avatarState.planeMode}
  {@const currentGridOffset = GRID_OFFSETS[currentPlaneMode]}
  {@const currentModeConfig = PLANE_MODE_CONFIGS[currentPlaneMode]}
  {#if currentPlaneMode === PlaneMode.DUAL_WHEEL}
    <!-- Left hand (blue) grid — offset in X (world space, no facing rotation) -->
    <Grid3D
      visiblePlanes={new Set([Plane.WHEEL])}
      centerPosition={{ x: avatarPosition.x + currentModeConfig.blueLateralOffset, y: avatarPosition.y, z: avatarPosition.z }}
      facingAngle={0}
      gridOffset={currentGridOffset}
      planeOpacity={0.10}
      showLabels={false}
      gridMode={(sequenceData?.gridMode ?? "diamond") as import("../domain/constants/grid-layout").GridMode}
    />
    <!-- Right hand (red) grid — offset in X (world space, no facing rotation) -->
    <Grid3D
      visiblePlanes={new Set([Plane.WHEEL])}
      centerPosition={{ x: avatarPosition.x + currentModeConfig.redLateralOffset, y: avatarPosition.y, z: avatarPosition.z }}
      facingAngle={0}
      gridOffset={currentGridOffset}
      planeOpacity={0.10}
      showLabels={false}
      gridMode={(sequenceData?.gridMode ?? "diamond") as import("../domain/constants/grid-layout").GridMode}
    />
  {:else}
    <Grid3D
      visiblePlanes={gridVisiblePlanes}
      centerPosition={avatarPosition}
      {facingAngle}
      gridOffset={currentGridOffset}
      planeOpacity={0.12}
      showLabels={false}
      gridMode={(sequenceData?.gridMode ?? "diamond") as import("../domain/constants/grid-layout").GridMode}
    />
  {/if}
{/if}

<!-- Avatar wrapped in offset Group: -STAGE_LIFT puts feet at floor y=0 -->
<T.Group position.y={-STAGE_LIFT}>
  <Avatar3D
    id="viewer"
    bluePropState={bluePropState}
    redPropState={redPropState}
    position={avatarPosition}
    {facingAngle}
    isActive={false}
    isMoving={false}
  />
</T.Group>

<!-- Blue prop (renders red in mirror mode so your red = their visual red) -->
{#if bluePropState}
  <Prop3D
    propType={isMirror ? redPropType : bluePropType}
    propState={bluePropState}
    color={isMirror ? "red" : "blue"}
    {avatarPosition}
    {facingAngle}
    gridOffset={propGridOffset}
    isActivePlayer={false}
  />
{/if}

<!-- Red prop (renders blue in mirror mode) -->
{#if redPropState}
  <Prop3D
    propType={isMirror ? bluePropType : redPropType}
    propState={redPropState}
    color={isMirror ? "blue" : "red"}
    {avatarPosition}
    {facingAngle}
    gridOffset={propGridOffset}
    isActivePlayer={false}
  />
{/if}

<!-- 3D Effects Orchestrator (trails, future: fire/LED/sparkle) -->
<EffectOrchestrator3D
  {bluePropState}
  {redPropState}
  {isPlaying}
  staffHalfLength={userProportionsState.staffLength / 2}
  {avatarPosition}
  {facingAngle}
  gridOffset={propGridOffset}
  {globalTipEffectMap}
/>
