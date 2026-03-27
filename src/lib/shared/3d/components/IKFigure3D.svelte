<script module lang="ts">
  export type BodyType = "masculine" | "feminine";
</script>

<script lang="ts">
  /**
   * IKFigure3D Component
   *
   * A humanoid figure with 2-bone IK arms.
   * Based on real-world measurements (default: 6'3" lanky build).
   *
   * Scale: 1 unit = 1 meter (so 34" staff = 0.864 meters)
   */

  import { T } from "@threlte/core";
  import { Vector3 } from "three";
  import type { PropState3D } from "../domain/models/PropState3D";
  import LimbSegment from "./LimbSegment.svelte";
  import {
    AUSTEN_MEASUREMENTS,
    deriveSceneProportions,
    type AvatarMeasurements,
  } from "../config/avatar-proportions";

  interface Props {
    bluePropState: PropState3D | null;
    redPropState: PropState3D | null;
    visible?: boolean;
    bodyType?: BodyType;
    skinTone?: string;
    measurements?: AvatarMeasurements;
    /** Position offset to convert world prop positions to local coordinates */
    positionOffset?: { x: number; y: number; z: number };
  }

  let {
    bluePropState,
    redPropState,
    visible = true,
    bodyType = "masculine" as BodyType,
    skinTone = "#d4a574",
    measurements = AUSTEN_MEASUREMENTS as AvatarMeasurements,
    positionOffset = { x: 0, y: 0, z: 0 },
  }: Props = $props();

  // Derive proportions from real measurements
  const figureProps = $derived(deriveSceneProportions(measurements, bodyType));

  // Colors
  const BODY_COLOR = "#4a5568";

  // ═══════════════════════════════════════════════════════════════════════════
  // 2-BONE IK SOLVER
  // ═══════════════════════════════════════════════════════════════════════════

  function solve2BoneIK(
    shoulder: Vector3,
    target: Vector3,
    upperLen: number,
    lowerLen: number,
    poleHint: Vector3
  ): { elbow: Vector3; wrist: Vector3 } {
    const toTarget = target.clone().sub(shoulder);
    const dist = toTarget.length();
    const maxReach = upperLen + lowerLen;
    const minReach = Math.abs(upperLen - lowerLen);

    // Clamp target to reachable range
    let reachDist = dist;
    if (dist > maxReach * 0.999) {
      reachDist = maxReach * 0.999;
    } else if (dist < minReach * 1.001) {
      reachDist = minReach * 1.001;
    }

    // Law of cosines: find angle at shoulder
    const cosAngle =
      (upperLen * upperLen + reachDist * reachDist - lowerLen * lowerLen) /
      (2 * upperLen * reachDist);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    // Direction to target
    const dir = toTarget.clone().normalize();

    // Find perpendicular axis for rotation (using pole hint)
    let perp = new Vector3().crossVectors(dir, poleHint);
    if (perp.lengthSq() < 0.0001) {
      perp = new Vector3().crossVectors(dir, new Vector3(0, 1, 0));
      if (perp.lengthSq() < 0.0001) {
        perp.set(1, 0, 0);
      }
    }
    perp.normalize();

    // Rotate direction by angle to get elbow direction
    const elbowDir = dir.clone().applyAxisAngle(perp, angle);
    const elbow = shoulder.clone().add(elbowDir.multiplyScalar(upperLen));

    // Wrist is at target (clamped)
    const wrist = shoulder.clone().add(dir.multiplyScalar(reachDist));

    return { elbow, wrist };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARM POSITIONS (reactive)
  // ═══════════════════════════════════════════════════════════════════════════

  // Shoulder positions
  const leftShoulder = $derived(
    new Vector3(
      -figureProps.shoulderX,
      figureProps.shoulderY,
      figureProps.figureZ
    )
  );
  const rightShoulder = $derived(
    new Vector3(
      figureProps.shoulderX,
      figureProps.shoulderY,
      figureProps.figureZ
    )
  );

  // Hand targets from prop states
  // IMPORTANT: Screen left (-X) = performer's RIGHT (red)
  //            Screen right (+X) = performer's LEFT (blue)
  // (Because we view the performer from in front)
  //
  // positionOffset converts world prop positions to local coordinates:
  // localPos = worldPos - offset
  const leftTarget = $derived(
    redPropState // Performer's RIGHT hand (screen left)
      ? new Vector3(
          redPropState.worldPosition.x - positionOffset.x,
          redPropState.worldPosition.y - positionOffset.y,
          redPropState.worldPosition.z - positionOffset.z
        )
      : new Vector3(
          -figureProps.shoulderX - figureProps.upperArmLength * 0.5,
          figureProps.shoulderY - figureProps.upperArmLength * 0.5,
          figureProps.figureZ + 0.2
        )
  );

  const rightTarget = $derived(
    bluePropState // Performer's LEFT hand (screen right)
      ? new Vector3(
          bluePropState.worldPosition.x - positionOffset.x,
          bluePropState.worldPosition.y - positionOffset.y,
          bluePropState.worldPosition.z - positionOffset.z
        )
      : new Vector3(
          figureProps.shoulderX + figureProps.upperArmLength * 0.5,
          figureProps.shoulderY - figureProps.upperArmLength * 0.5,
          figureProps.figureZ + 0.2
        )
  );

  // Pole hints (where elbows should bend toward - backward and outward)
  const leftPole = new Vector3(-0.5, -0.3, -1).normalize();
  const rightPole = new Vector3(0.5, -0.3, -1).normalize();

  // Solve IK for both arms
  const leftArm = $derived(
    solve2BoneIK(
      leftShoulder,
      leftTarget,
      figureProps.upperArmLength,
      figureProps.forearmLength,
      leftPole
    )
  );
  const rightArm = $derived(
    solve2BoneIK(
      rightShoulder,
      rightTarget,
      figureProps.upperArmLength,
      figureProps.forearmLength,
      rightPole
    )
  );

  // Convert to tuple format for Threlte
  const toTuple = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

  const leftShoulderPos = $derived(toTuple(leftShoulder));
  const leftElbowPos = $derived(toTuple(leftArm.elbow));
  const leftWristPos = $derived(toTuple(leftArm.wrist));

  const rightShoulderPos = $derived(toTuple(rightShoulder));
  const rightElbowPos = $derived(toTuple(rightArm.elbow));
  const rightWristPos = $derived(toTuple(rightArm.wrist));

  // Body part positions
  const headPos = $derived<[number, number, number]>([
    0,
    figureProps.headY,
    figureProps.figureZ,
  ]);
  const neckPos = $derived<[number, number, number]>([
    0,
    figureProps.neckY,
    figureProps.figureZ,
  ]);
  const torsoPos = $derived<[number, number, number]>([
    0,
    figureProps.torsoY,
    figureProps.figureZ,
  ]);
  const hipPos = $derived<[number, number, number]>([
    0,
    figureProps.hipY,
    figureProps.figureZ,
  ]);

  // Leg positions (thigh center, shin center)
  const leftThighY = $derived((figureProps.hipY + figureProps.kneeY) / 2);
  const rightThighY = $derived(leftThighY);
  const leftShinY = $derived((figureProps.kneeY + figureProps.ankleY) / 2);
  const rightShinY = $derived(leftShinY);
</script>

{#if visible}
  <!-- ═══════════════ LEFT ARM ═══════════════ -->
  <LimbSegment
    from={leftShoulderPos}
    to={leftElbowPos}
    thickness={figureProps.armThickness}
    color={skinTone}
  />
  <LimbSegment
    from={leftElbowPos}
    to={leftWristPos}
    thickness={figureProps.armThickness}
    color={skinTone}
  />

  <T.Mesh position={leftShoulderPos}>
    <T.SphereGeometry args={[figureProps.jointRadius, 12, 12]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>
  <T.Mesh position={leftElbowPos}>
    <T.SphereGeometry args={[figureProps.jointRadius, 12, 12]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>
  <T.Mesh position={leftWristPos}>
    <T.SphereGeometry args={[figureProps.wristRadius, 12, 12]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>

  <!-- ═══════════════ RIGHT ARM ═══════════════ -->
  <LimbSegment
    from={rightShoulderPos}
    to={rightElbowPos}
    thickness={figureProps.armThickness}
    color={skinTone}
  />
  <LimbSegment
    from={rightElbowPos}
    to={rightWristPos}
    thickness={figureProps.armThickness}
    color={skinTone}
  />

  <T.Mesh position={rightShoulderPos}>
    <T.SphereGeometry args={[figureProps.jointRadius, 12, 12]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>
  <T.Mesh position={rightElbowPos}>
    <T.SphereGeometry args={[figureProps.jointRadius, 12, 12]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>
  <T.Mesh position={rightWristPos}>
    <T.SphereGeometry args={[figureProps.wristRadius, 12, 12]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>

  <!-- ═══════════════ HEAD & NECK ═══════════════ -->
  <T.Mesh position={headPos}>
    <T.SphereGeometry args={[figureProps.headRadius, 16, 16]} />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>

  <T.Mesh position={neckPos}>
    <T.CylinderGeometry
      args={[
        figureProps.neckRadius,
        figureProps.neckRadius,
        figureProps.neckLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={skinTone} roughness={0.6} />
  </T.Mesh>

  <!-- ═══════════════ TORSO ═══════════════ -->
  <T.Mesh position={torsoPos}>
    <T.CylinderGeometry
      args={[
        figureProps.torsoTopRadius,
        figureProps.torsoBottomRadius,
        figureProps.torsoLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Shoulders bar -->
  <T.Mesh
    position={[0, figureProps.shoulderY, figureProps.figureZ]}
    rotation={[0, 0, Math.PI / 2]}
  >
    <T.CylinderGeometry
      args={[
        figureProps.shoulderBarRadius,
        figureProps.shoulderBarRadius,
        figureProps.shoulderX * 2,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Hips bar -->
  <T.Mesh position={hipPos} rotation={[0, 0, Math.PI / 2]}>
    <T.CylinderGeometry
      args={[
        figureProps.hipBarRadius,
        figureProps.hipBarRadius,
        figureProps.hipWidth * 2,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- ═══════════════ LEGS ═══════════════ -->
  <!-- Left thigh -->
  <T.Mesh position={[-figureProps.hipWidth, leftThighY, figureProps.figureZ]}>
    <T.CylinderGeometry
      args={[
        figureProps.legThickness,
        figureProps.legThickness * 0.9,
        figureProps.thighLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Right thigh -->
  <T.Mesh position={[figureProps.hipWidth, rightThighY, figureProps.figureZ]}>
    <T.CylinderGeometry
      args={[
        figureProps.legThickness,
        figureProps.legThickness * 0.9,
        figureProps.thighLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Left shin -->
  <T.Mesh position={[-figureProps.hipWidth, leftShinY, figureProps.figureZ]}>
    <T.CylinderGeometry
      args={[
        figureProps.legThickness * 0.9,
        figureProps.legThickness * 0.7,
        figureProps.shinLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Right shin -->
  <T.Mesh position={[figureProps.hipWidth, rightShinY, figureProps.figureZ]}>
    <T.CylinderGeometry
      args={[
        figureProps.legThickness * 0.9,
        figureProps.legThickness * 0.7,
        figureProps.shinLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Left foot -->
  <T.Mesh
    position={[
      -figureProps.hipWidth,
      figureProps.footY,
      figureProps.figureZ + figureProps.footLength / 3,
    ]}
    rotation={[Math.PI / 2, 0, 0]}
  >
    <T.CylinderGeometry
      args={[
        figureProps.legThickness * 0.7,
        figureProps.legThickness * 0.6,
        figureProps.footLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>

  <!-- Right foot -->
  <T.Mesh
    position={[
      figureProps.hipWidth,
      figureProps.footY,
      figureProps.figureZ + figureProps.footLength / 3,
    ]}
    rotation={[Math.PI / 2, 0, 0]}
  >
    <T.CylinderGeometry
      args={[
        figureProps.legThickness * 0.7,
        figureProps.legThickness * 0.6,
        figureProps.footLength,
        8,
      ]}
    />
    <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
  </T.Mesh>
{/if}
