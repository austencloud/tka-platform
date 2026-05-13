<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import Scene3D from "$lib/shared/3d/components/Scene3D.svelte";
  import { Avatar3D, Prop3D } from "@austencloud/scene-3d";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { snapToNearestGridLocation } from "../services/grid-snap";
  import { Vector3 } from "three";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();
  let rafId: number;

  function handleMeshClick(meshName: string, _point: { x: number; y: number; z: number }) {
    if (labState.mode === "sequence") return;
    const lcName = meshName.toLowerCase();
    if (lcName.includes("blue") || lcName.includes("staff_blue") || lcName.includes("prop_blue")) {
      labState.draggingSide = "blue";
    } else if (lcName.includes("red") || lcName.includes("staff_red") || lcName.includes("prop_red")) {
      labState.draggingSide = "red";
    }
  }

  function handleDrag(position: { x: number; z: number }) {
    if (!labState.draggingSide) return;
    const dragPoint = new Vector3(position.x, 0, position.z);
    const nearest = snapToNearestGridLocation(dragPoint, labState.activePlane);
    labState.setLocation(labState.draggingSide, nearest);
  }

  function handlePointerUp() {
    labState.draggingSide = null;
  }

  function tick() {
    labState.tick();
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => { rafId = requestAnimationFrame(tick); });
  onDestroy(() => { cancelAnimationFrame(rafId); });
</script>

<div class="scene-container">
  <Scene3D
    cameraPreset={labState.cameraPreset}
    showGrid={labState.showGrid}
    showLabels={labState.showLabels}
    showStage={labState.showStage}
    visiblePlanes={labState.visiblePlanes}
    disableOrbitControls={labState.draggingSide !== null}
    isDragging={labState.draggingSide !== null}
    onMeshClick={handleMeshClick}
    onDrag={handleDrag}
    onPointerUp={handlePointerUp}
  >
    {#snippet children()}
      <Prop3D
        propType={PropType.STAFF}
        propState={labState.bluePropState}
        color="blue"
      />
      <Prop3D
        propType={PropType.STAFF}
        propState={labState.redPropState}
        color="red"
      />
      <Avatar3D
        bluePropState={labState.bluePropState}
        redPropState={labState.redPropState}
        position={{ x: 0, y: 0, z: 0 }}
        facingAngle={labState.facingAngle}
      />
    {/snippet}
  </Scene3D>
</div>

<style>
  .scene-container {
    flex: 1;
    min-width: 0;
    min-height: 300px;
  }
</style>
