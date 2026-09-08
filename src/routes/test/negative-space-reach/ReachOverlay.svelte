<script lang="ts">
  /**
   * The measurement, drawn on the body it was taken from.
   *
   * A panel of millimetres is only worth as much as the reader's willingness to
   * believe them. This puts the same points back into the scene — the arm
   * chain, the two staff ends, and the perpendicular whose sign IS the
   * document's negative-space predicate — so a disagreement can be settled by
   * looking rather than by trusting the arithmetic.
   *
   * Read-only. Every point comes from the frame the telemetry already measured;
   * nothing here is fed back into the pose, the grip, or the solve.
   */

  import { T } from "@threlte/core";
  import { Quaternion, Vector3 } from "three";

  import type { ReachFrame, Vec3 } from "./reach-telemetry";
  import { routeVerdict } from "./reach-telemetry";

  interface Props {
    frame: ReachFrame;
  }

  let { frame }: Props = $props();

  /** Joint markers stay small: the point is the geometry, not the dots. */
  const JOINT_RADIUS = 0.018;
  const END_RADIUS = 0.026;
  const BAR_RADIUS = 0.006;

  const NEUTRAL = "#9aa7bd";
  const PINKY = "#7fd1ff";
  /** Upstage of the forearm: the pocket the document's §4 route uses. */
  const UPSTAGE = "#4ade80";
  /** Downstage of the forearm: the §5 route's side. */
  const DOWNSTAGE = "#fbbf24";
  const IN_PLANE = "#c4b5fd";

  const verdict = $derived(routeVerdict(frame));
  const thumbColor = $derived(
    verdict === "negative-space"
      ? UPSTAGE
      : verdict === "downstage"
        ? DOWNSTAGE
        : IN_PLANE
  );

  function point(value: Vec3 | null): [number, number, number] | null {
    return value ? [value.x, value.y, value.z] : null;
  }

  interface Bar {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    length: number;
  }

  const UP = new Vector3(0, 1, 0);
  const from = new Vector3();
  const to = new Vector3();
  const direction = new Vector3();
  const rotation = new Quaternion();

  /**
   * A cylinder spanning two world points. Three's cylinder stands on +Y, so
   * the rotation is the one that carries +Y onto the span; the mesh then sits
   * at the midpoint.
   */
  function bar(a: Vec3 | null, b: Vec3 | null): Bar | null {
    if (!a || !b) return null;
    from.set(a.x, a.y, a.z);
    to.set(b.x, b.y, b.z);
    direction.subVectors(to, from);
    const length = direction.length();
    if (length < 1e-5) return null;
    rotation.setFromUnitVectors(UP, direction.clone().divideScalar(length));
    return {
      position: [
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        (a.z + b.z) / 2,
      ],
      quaternion: [rotation.x, rotation.y, rotation.z, rotation.w],
      length,
    };
  }

  /**
   * The foot of the perpendicular from the thumb end onto the forearm axis.
   * Drawing the bar between the thumb end and this point shows the exact
   * quantity `thumbEndVsForearmMm` reports the depth component of.
   */
  const forearmFoot = $derived.by((): Vec3 | null => {
    const { elbow, wrist, thumbEnd } = frame;
    if (!elbow || !wrist || !thumbEnd) return null;
    const ax = wrist.x - elbow.x;
    const ay = wrist.y - elbow.y;
    const az = wrist.z - elbow.z;
    const lengthSquared = ax * ax + ay * ay + az * az;
    if (lengthSquared < 1e-10) return null;
    const t =
      ((thumbEnd.x - elbow.x) * ax +
        (thumbEnd.y - elbow.y) * ay +
        (thumbEnd.z - elbow.z) * az) /
      lengthSquared;
    return {
      x: elbow.x + ax * t,
      y: elbow.y + ay * t,
      z: elbow.z + az * t,
    };
  });

  const upperArm = $derived(bar(frame.shoulder, frame.elbow));
  const forearm = $derived(bar(frame.elbow, frame.wrist));
  const offset = $derived(bar(frame.thumbEnd, forearmFoot));

  const shoulderPoint = $derived(point(frame.shoulder));
  const elbowPoint = $derived(point(frame.elbow));
  const wristPoint = $derived(point(frame.wrist));
  const thumbPoint = $derived(point(frame.thumbEnd));
  const pinkyPoint = $derived(point(frame.pinkyEnd));
</script>

<!--
  Depth testing off and a high render order, so the arm chain stays readable
  when the body itself is between it and the camera. An overlay that vanishes
  behind the shoulder is useless in exactly the pose this page is about.
-->
{#if upperArm}
  <T.Mesh
    position={upperArm.position}
    quaternion={upperArm.quaternion}
    renderOrder={998}
  >
    <T.CylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, upperArm.length, 8]} />
    <T.MeshBasicMaterial
      color={NEUTRAL}
      depthTest={false}
      transparent
      opacity={0.75}
    />
  </T.Mesh>
{/if}

{#if forearm}
  <T.Mesh
    position={forearm.position}
    quaternion={forearm.quaternion}
    renderOrder={998}
  >
    <T.CylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, forearm.length, 8]} />
    <T.MeshBasicMaterial
      color={NEUTRAL}
      depthTest={false}
      transparent
      opacity={0.9}
    />
  </T.Mesh>
{/if}

{#if offset}
  <T.Mesh
    position={offset.position}
    quaternion={offset.quaternion}
    renderOrder={999}
  >
    <T.CylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, offset.length, 8]} />
    <T.MeshBasicMaterial color={thumbColor} depthTest={false} />
  </T.Mesh>
{/if}

{#each [shoulderPoint, elbowPoint, wristPoint] as joint (joint)}
  {#if joint}
    <T.Mesh position={joint} renderOrder={999}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshBasicMaterial color={NEUTRAL} depthTest={false} />
    </T.Mesh>
  {/if}
{/each}

{#if thumbPoint}
  <T.Mesh position={thumbPoint} renderOrder={1000}>
    <T.SphereGeometry args={[END_RADIUS, 14, 14]} />
    <T.MeshBasicMaterial color={thumbColor} depthTest={false} />
  </T.Mesh>
{/if}

{#if pinkyPoint}
  <T.Mesh position={pinkyPoint} renderOrder={1000}>
    <T.SphereGeometry args={[END_RADIUS, 14, 14]} />
    <T.MeshBasicMaterial color={PINKY} depthTest={false} />
  </T.Mesh>
{/if}
