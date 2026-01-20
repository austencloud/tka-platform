<script lang="ts">
  /**
   * StickFigure3D Component
   *
   * A humanoid figure with realistic proportions that holds props.
   * Uses 2-bone IK for arm positioning with anatomical constraints.
   * Figure stands forward (toward audience) so arms reach back to wall plane.
   *
   * Scale: 1 unit = 1 meter (unified meters scale)
   */

  import { T } from "@threlte/core";
  import { Vector3 } from "three";
  import type { PropState3D } from "../domain/models/PropState3D";
  import { GRID_RADIUS_3D } from "../domain/constants/plane-transforms";

  interface Props {
    /** Blue prop state (left hand in performer's perspective) */
    bluePropState: PropState3D | null;
    /** Red prop state (right hand in performer's perspective) */
    redPropState: PropState3D | null;
    /** Whether to show the figure */
    visible?: boolean;
  }

  let { bluePropState, redPropState, visible = true }: Props = $props();

  // ═══════════════════════════════════════════════════════════════════════════
  // REALISTIC HUMAN PROPORTIONS
  // Scale: 1 unit = 1 meter (unified meters scale)
  // ═══════════════════════════════════════════════════════════════════════════

  // Arm segments (real human: upper arm ~30cm, forearm ~25cm)
  const UPPER_ARM_LENGTH = 0.30; // 30cm = 0.30 meters
  const FOREARM_LENGTH = 0.25; // 25cm = 0.25 meters
  const TOTAL_ARM_LENGTH = UPPER_ARM_LENGTH + FOREARM_LENGTH; // 0.55 meters

  // Body dimensions
  const HEAD_RADIUS = 0.10; // 10cm radius = 20cm diameter head
  const JOINT_RADIUS = 0.032; // ~3.2cm, realistic joints
  const LIMB_THICKNESS = 0.032; // ~3.2cm, thinner limbs

  // Vertical positions (Y)
  // Figure positioned so shoulders are at a height where arms can work the grid
  // Real human: shoulder height ~145cm from ground
  // We offset so the figure's "center" is roughly at grid center
  const SHOULDER_Y = 0; // Shoulders at grid center height for best reach
  const HEAD_Y = SHOULDER_Y + 0.26; // Head above shoulders (~26cm)
  const HIP_Y = SHOULDER_Y - 0.40; // Hips below shoulders (~40cm)
  const KNEE_Y = HIP_Y - 0.45; // Thigh length ~45cm
  const FOOT_Y = KNEE_Y - 0.42; // Shin length ~42cm

  // Horizontal positions (width)
  const SHOULDER_SPREAD = 0.22; // 22cm each side (44cm total width)
  const HIP_SPREAD = 0.15; // 15cm each side (30cm total)

  // Figure stands BEHIND the grid (negative Z), facing the audience
  // Arms reach FORWARD to the wall plane (Z = 0)
  // Distance needed: sqrt(arm² - lateral²) = sqrt(0.55² - 0.38²) ≈ 0.40
  const FIGURE_Z = -0.40;

  // Body joint positions (figure stands at Z = FIGURE_Z)
  const headPos: [number, number, number] = [0, HEAD_Y, FIGURE_Z];
  const leftShoulderPos: [number, number, number] = [
    -SHOULDER_SPREAD,
    SHOULDER_Y,
    FIGURE_Z,
  ];
  const rightShoulderPos: [number, number, number] = [
    SHOULDER_SPREAD,
    SHOULDER_Y,
    FIGURE_Z,
  ];
  const leftHipPos: [number, number, number] = [-HIP_SPREAD, HIP_Y, FIGURE_Z];
  const rightHipPos: [number, number, number] = [HIP_SPREAD, HIP_Y, FIGURE_Z];
  const leftKneePos: [number, number, number] = [-HIP_SPREAD, KNEE_Y, FIGURE_Z];
  const rightKneePos: [number, number, number] = [HIP_SPREAD, KNEE_Y, FIGURE_Z];
  const leftFootPos: [number, number, number] = [-HIP_SPREAD, FOOT_Y, FIGURE_Z];
  const rightFootPos: [number, number, number] = [HIP_SPREAD, FOOT_Y, FIGURE_Z];

  // Hand positions from prop states (hands reach to grip points on the planes)
  const leftHandPos = $derived<[number, number, number]>(
    bluePropState
      ? [
          bluePropState.worldPosition.x,
          bluePropState.worldPosition.y,
          bluePropState.worldPosition.z,
        ]
      : [-SHOULDER_SPREAD - 0.12, SHOULDER_Y - 0.20, FIGURE_Z + 0.24] // Relaxed in front
  );

  const rightHandPos = $derived<[number, number, number]>(
    redPropState
      ? [
          redPropState.worldPosition.x,
          redPropState.worldPosition.y,
          redPropState.worldPosition.z,
        ]
      : [SHOULDER_SPREAD + 0.12, SHOULDER_Y - 0.20, FIGURE_Z + 0.24] // Relaxed in front
  );

  // Calculate limb segment for cylinder positioning
  // Returns: { position, rotation, length } for a cylinder connecting two points
  function getLimbGeometry(
    from: [number, number, number],
    to: [number, number, number]
  ) {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const length = start.distanceTo(end);

    // Direction from start to end
    const dir = end.clone().sub(start).normalize();

    // Calculate rotation to align Y-axis (cylinder default) with direction
    // Using spherical coordinates approach
    const phi = Math.acos(dir.y); // Angle from Y-axis
    const theta = Math.atan2(dir.x, dir.z); // Rotation around Y

    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      rotation: [phi, theta, 0] as [number, number, number],
      length,
    };
  }

  /**
   * Calculate elbow position using 2-bone IK with anatomical constraints.
   *
   * Elbow "pole" hint: Real human elbows bend in a consistent plane.
   * When arms are at sides: elbows point backward
   * When arms are raised: elbows point outward/down
   *
   * We use a weighted combination of backward (-Z) and outward (±X) based
   * on hand position relative to shoulder.
   */
  function calculateElbowPosition(
    shoulder: [number, number, number],
    hand: [number, number, number],
    upperArmLen: number,
    forearmLen: number,
    isLeft: boolean
  ): [number, number, number] {
    const shoulderVec = new Vector3(...shoulder);
    const handVec = new Vector3(...hand);

    // Distance from shoulder to hand
    const shoulderToHand = handVec.clone().sub(shoulderVec);
    const distance = shoulderToHand.length();

    // If hand is too far, extend arm fully (stretchy fallback)
    const maxReach = upperArmLen + forearmLen;
    if (distance >= maxReach * 0.99) {
      // Arm nearly/fully extended - elbow at proportional point along line
      const t = upperArmLen / maxReach;
      return [
        shoulder[0] + shoulderToHand.x * t,
        shoulder[1] + shoulderToHand.y * t,
        shoulder[2] + shoulderToHand.z * t,
      ];
    }

    // If hand is very close, just bend elbow backward
    const minReach = Math.abs(upperArmLen - forearmLen);
    if (distance <= minReach * 1.1) {
      return [
        shoulder[0],
        shoulder[1],
        shoulder[2] + upperArmLen * 0.7, // Elbow behind shoulder
      ];
    }

    // Normal case: use law of cosines to find elbow angle
    const a = forearmLen;
    const b = upperArmLen;
    const c = distance;

    // Angle at shoulder (between upper arm and shoulder-to-hand line)
    const cosAngle = (b * b + c * c - a * a) / (2 * b * c);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    // Direction from shoulder to hand
    const dir = shoulderToHand.clone().normalize();

    // ═══════════════════════════════════════════════════════════════════════
    // ANATOMICAL ELBOW HINT
    // Calculate a "pole" vector that determines which way the elbow bends
    //
    // Figure faces +Z (toward audience), so elbows bend backward toward -Z
    // ═══════════════════════════════════════════════════════════════════════

    // Outward component (away from body center)
    const outward = isLeft ? -1 : 1;

    // Weight factors based on hand position (in meters)
    const handHeight = hand[1] - shoulder[1];
    const heightFactor = Math.max(0, Math.min(1, (handHeight + 0.4) / 0.8));

    // How far forward is the hand? (positive when hand is in front of shoulder toward +Z)
    const handForward = hand[2] - shoulder[2];
    const forwardFactor = Math.max(0, Math.min(1, (handForward + 0.2) / 0.6));

    const hint = new Vector3(
      outward * (0.3 + heightFactor * 0.5), // Outward component
      -0.2 - heightFactor * 0.2, // Slightly down when raised
      -0.6 - forwardFactor * 0.4 // Backward (-Z, toward figure's back)
    ).normalize();

    // Get perpendicular axis for rotation
    const perp = new Vector3().crossVectors(dir, hint);

    // If vectors are nearly parallel, use fallback
    if (perp.length() < 0.01) {
      perp.set(0, 1, 0).cross(dir);
      if (perp.length() < 0.01) {
        perp.set(1, 0, 0);
      }
    }
    perp.normalize();

    // Rotate the direction vector by the angle around the perpendicular
    const elbowDir = dir
      .clone()
      .applyAxisAngle(perp, angle)
      .multiplyScalar(upperArmLen);

    const elbow = shoulderVec.clone().add(elbowDir);

    return [elbow.x, elbow.y, elbow.z];
  }

  // Calculate elbow positions
  const leftElbowPos = $derived(
    calculateElbowPosition(
      leftShoulderPos,
      leftHandPos,
      UPPER_ARM_LENGTH,
      FOREARM_LENGTH,
      true
    )
  );
  const rightElbowPos = $derived(
    calculateElbowPosition(
      rightShoulderPos,
      rightHandPos,
      UPPER_ARM_LENGTH,
      FOREARM_LENGTH,
      false
    )
  );

  // Limb geometries (derived from positions)
  const neckPos: [number, number, number] = [0, SHOULDER_Y, FIGURE_Z];
  const hipCenterPos: [number, number, number] = [0, HIP_Y, FIGURE_Z];

  const torso = $derived(getLimbGeometry(neckPos, hipCenterPos));

  // Arms now have two segments each
  const leftUpperArm = $derived(getLimbGeometry(leftShoulderPos, leftElbowPos));
  const leftForearm = $derived(getLimbGeometry(leftElbowPos, leftHandPos));
  const rightUpperArm = $derived(
    getLimbGeometry(rightShoulderPos, rightElbowPos)
  );
  const rightForearm = $derived(getLimbGeometry(rightElbowPos, rightHandPos));

  const leftThigh = $derived(getLimbGeometry(leftHipPos, leftKneePos));
  const rightThigh = $derived(getLimbGeometry(rightHipPos, rightKneePos));
  const leftShin = $derived(getLimbGeometry(leftKneePos, leftFootPos));
  const rightShin = $derived(getLimbGeometry(rightKneePos, rightFootPos));

  // Colors
  const SKIN_COLOR = "#d4a574";
  const BODY_COLOR = "#4a5568";
</script>

{#if visible}
  <T.Group>
    <!-- HEAD -->
    <T.Mesh position={headPos}>
      <T.SphereGeometry args={[HEAD_RADIUS, 16, 16]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- NECK (small connector) -->
    <T.Mesh position={[0, SHOULDER_Y + 0.08, FIGURE_Z]}>
      <T.CylinderGeometry args={[LIMB_THICKNESS, LIMB_THICKNESS, 0.12, 8]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- TORSO -->
    <T.Mesh position={torso.position} rotation={torso.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS * 1.5, LIMB_THICKNESS * 1.2, torso.length, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>

    <!-- SHOULDERS (horizontal bar) -->
    <T.Mesh position={[0, SHOULDER_Y, FIGURE_Z]} rotation={[0, 0, Math.PI / 2]}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, SHOULDER_SPREAD * 2, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>

    <!-- SHOULDER JOINTS -->
    <T.Mesh position={leftShoulderPos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>
    <T.Mesh position={rightShoulderPos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- LEFT ARM - Upper arm -->
    <T.Mesh position={leftUpperArm.position} rotation={leftUpperArm.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, leftUpperArm.length, 8]}
      />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- LEFT ELBOW -->
    <T.Mesh position={leftElbowPos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- LEFT ARM - Forearm -->
    <T.Mesh position={leftForearm.position} rotation={leftForearm.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, leftForearm.length, 8]}
      />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- RIGHT ARM - Upper arm -->
    <T.Mesh position={rightUpperArm.position} rotation={rightUpperArm.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, rightUpperArm.length, 8]}
      />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- RIGHT ELBOW -->
    <T.Mesh position={rightElbowPos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- RIGHT ARM - Forearm -->
    <T.Mesh position={rightForearm.position} rotation={rightForearm.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, rightForearm.length, 8]}
      />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- HAND JOINTS (at prop grip points) -->
    <T.Mesh position={leftHandPos}>
      <T.SphereGeometry args={[JOINT_RADIUS * 1.3, 12, 12]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>
    <T.Mesh position={rightHandPos}>
      <T.SphereGeometry args={[JOINT_RADIUS * 1.3, 12, 12]} />
      <T.MeshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
    </T.Mesh>

    <!-- HIPS (horizontal bar) -->
    <T.Mesh position={[0, HIP_Y, FIGURE_Z]} rotation={[0, 0, Math.PI / 2]}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, HIP_SPREAD * 2, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>

    <!-- HIP JOINTS -->
    <T.Mesh position={leftHipPos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={rightHipPos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>

    <!-- LEFT LEG -->
    <T.Mesh position={leftThigh.position} rotation={leftThigh.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, leftThigh.length, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={leftKneePos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={leftShin.position} rotation={leftShin.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, leftShin.length, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={leftFootPos}>
      <T.SphereGeometry args={[JOINT_RADIUS * 1.3, 12, 12]} />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>

    <!-- RIGHT LEG -->
    <T.Mesh position={rightThigh.position} rotation={rightThigh.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, rightThigh.length, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={rightKneePos}>
      <T.SphereGeometry args={[JOINT_RADIUS, 12, 12]} />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={rightShin.position} rotation={rightShin.rotation}>
      <T.CylinderGeometry
        args={[LIMB_THICKNESS, LIMB_THICKNESS, rightShin.length, 8]}
      />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
    <T.Mesh position={rightFootPos}>
      <T.SphereGeometry args={[JOINT_RADIUS * 1.3, 12, 12]} />
      <T.MeshStandardMaterial color={BODY_COLOR} roughness={0.5} />
    </T.Mesh>
  </T.Group>
{/if}
