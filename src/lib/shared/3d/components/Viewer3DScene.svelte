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
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { Plane } from "../domain/enums/Plane";
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
  // Avatar faces +Z (toward audience) at facingAngle=0. The default camera
  // sits at -Z (behind the performer), so the viewer sees the avatar's back.
  // This matches TKA pictograph notation: performer's right (red) appears on
  // the viewer's right, performer's left (blue) on the viewer's left.
  const facingAngle = 0;

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
    avatarState.goToStep(beatIndex);
    avatarState.setProgress(subBeatProgress);
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
</script>

<!-- Lighting -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[5, 10, 5]} intensity={0.8} />

<!-- Ground disc -->
<T.Mesh rotation.x={-Math.PI / 2}>
  <T.CircleGeometry args={[2, 64]} />
  <T.MeshStandardMaterial color="#1a1a2e" />
</T.Mesh>

<!-- Grid planes (wall/wheel/floor discs) — toggled via viewer state.
     centerPosition matches avatarPosition so the grid is at shoulder height
     where the props actually rotate, not at ground level. -->
{#if viewer3DState.showGrid}
  <Grid3D
    visiblePlanes={gridVisiblePlanes}
    centerPosition={avatarPosition}
    {facingAngle}
    gridOffset={0.3}
    planeOpacity={0.12}
    showLabels={false}
    gridMode={sequenceData?.gridMode ?? "diamond"}
  />
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
    gridOffset={0.3}
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
    gridOffset={0.3}
    isActivePlayer={false}
  />
{/if}
