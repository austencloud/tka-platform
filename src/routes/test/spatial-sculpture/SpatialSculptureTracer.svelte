<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    Plane,
    Prop3D,
    PropType,
    type Plane as PlaneValue,
  } from "@austencloud/scene-3d";
  import type { CatmullRomCurve3, Vector3 } from "three";
  import type {
    PropSide,
    SculptureMotionMode,
    SpatialBeat,
  } from "./spatial-sculpture-model";
  import {
    calculateUndulationScale,
    createTracerPose,
  } from "./spatial-sculpture-motion";

  interface Props {
    leftCurve: CatmullRomCurve3;
    rightCurve: CatmullRomCurve3;
    beats: SpatialBeat[];
    activeBeatIndex: number;
    activeHand: PropSide;
    playing: boolean;
    motionMode: SculptureMotionMode;
    undulationDepth: number;
    undulationPeriod: number;
    onplayheadbeat: (index: number) => void;
    onscalechange: (scale: number) => void;
  }

  let {
    leftCurve,
    rightCurve,
    beats,
    activeBeatIndex,
    activeHand,
    playing,
    motionMode,
    undulationDepth,
    undulationPeriod,
    onplayheadbeat,
    onscalechange,
  }: Props = $props();

  const BEAT_SECONDS = 0.68;
  const BASE_PROP_LENGTH = 0.62;

  let progress = $state(beats.length > 0 ? activeBeatIndex / beats.length : 0);
  let undulationPhase = 0.25;
  let sculptureScale = $state(1);
  let lastReportedBeat = activeBeatIndex;
  let lastMotionMode = motionMode;

  const propLength = $derived(BASE_PROP_LENGTH * sculptureScale);
  const currentPlane = $derived.by((): PlaneValue => {
    if (beats.length === 0) return Plane.WALL;
    const index = Math.min(
      beats.length - 1,
      Math.floor(progress * beats.length)
    );
    return beats[index]?.plane ?? Plane.WALL;
  });
  const leftPose = $derived(
    createTracerPose(
      leftCurve,
      progress,
      sculptureScale,
      propLength,
      currentPlane
    )
  );
  const rightPose = $derived(
    createTracerPose(
      rightCurve,
      progress,
      sculptureScale,
      propLength,
      currentPlane
    )
  );

  function positionTuple(point: Vector3): [number, number, number] {
    return [point.x, point.y, point.z];
  }

  $effect(() => {
    if (playing || beats.length === 0) return;
    progress = activeBeatIndex / beats.length;
    lastReportedBeat = activeBeatIndex;
  });

  useTask((delta) => {
    if (motionMode !== lastMotionMode) {
      lastMotionMode = motionMode;
      if (motionMode === "undulate") undulationPhase = 0.25;
    }

    if (playing && beats.length > 0) {
      const loopSeconds = Math.max(BEAT_SECONDS, beats.length * BEAT_SECONDS);
      progress = (progress + delta / loopSeconds) % 1;
      undulationPhase =
        (undulationPhase + delta / Math.max(0.5, undulationPeriod)) % 1;
    }

    const nextScale =
      motionMode === "undulate"
        ? calculateUndulationScale(
            undulationPhase,
            Math.max(0, undulationDepth) / 100
          )
        : 1;

    if (Math.abs(nextScale - sculptureScale) > 0.0001) {
      sculptureScale = nextScale;
      onscalechange(nextScale);
    }

    if (!playing || beats.length === 0) return;
    const nextBeat = Math.min(
      beats.length - 1,
      Math.floor(progress * beats.length)
    );
    if (nextBeat !== lastReportedBeat) {
      lastReportedBeat = nextBeat;
      onplayheadbeat(nextBeat);
    }
  });
</script>

<T.Group position={positionTuple(leftPose.center)}>
  <Prop3D
    propType={PropType.STAFF}
    propState={leftPose.propState}
    color="blue"
    length={propLength}
  />
</T.Group>
<T.Group position={positionTuple(rightPose.center)}>
  <Prop3D
    propType={PropType.STAFF}
    propState={rightPose.propState}
    color="red"
    length={propLength}
  />
</T.Group>

<T.Mesh position={positionTuple(leftPose.tip)} renderOrder={12}>
  <T.SphereGeometry args={[activeHand === "left" ? 0.054 : 0.038, 18, 18]} />
  <T.MeshBasicMaterial
    color="#8ed0ff"
    transparent
    opacity={activeHand === "left" ? 1 : 0.72}
    depthWrite={false}
  />
</T.Mesh>
<T.Mesh position={positionTuple(rightPose.tip)} renderOrder={12}>
  <T.SphereGeometry args={[activeHand === "right" ? 0.054 : 0.038, 18, 18]} />
  <T.MeshBasicMaterial
    color="#ff9aaa"
    transparent
    opacity={activeHand === "right" ? 1 : 0.72}
    depthWrite={false}
  />
</T.Mesh>
