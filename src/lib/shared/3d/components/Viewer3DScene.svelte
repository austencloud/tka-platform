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
  import Avatar3D from "./Avatar3D.svelte";
  import Staff3D from "./Staff3D.svelte";
  import Grid3D from "./Grid3D.svelte";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { Plane } from "../domain/enums/Plane";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
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

  // In mirror mode, swap blue↔red so the performer mirrors the viewer.
  // The viewer's right hand maps to the performer's left hand (blue) and vice versa.
  const isMirror = $derived(viewer3DState.mirrorMode);
  const bluePropState = $derived(isMirror ? avatarState.redPropState : avatarState.bluePropState);
  const redPropState = $derived(isMirror ? avatarState.bluePropState : avatarState.redPropState);

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
    showLabels={true}
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

<!-- Blue staff -->
{#if bluePropState}
  <Staff3D
    propState={bluePropState}
    color="blue"
    {avatarPosition}
    {facingAngle}
    gridOffset={0.3}
    isActivePlayer={false}
  />
{/if}

<!-- Red staff -->
{#if redPropState}
  <Staff3D
    propState={redPropState}
    color="red"
    {avatarPosition}
    {facingAngle}
    gridOffset={0.3}
    isActivePlayer={false}
  />
{/if}
