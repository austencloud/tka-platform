/**
 * Camera-choreography shot helpers.
 *
 * Pure functions that compute camera target + eye position for each
 * plane-locked shot and the auto-orbit opening shot. Shared across
 * presets so Plane-locked, Quad-plane tour, and Ensemble-focus all
 * frame the same way.
 */

import * as THREE from "three";
import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";

export type Plane3 = "wall" | "wheel" | "floor";

/** Body-reference y-level used as camera target height. */
export const TARGET_Y = 0;
/**
 * Safety padding added to the performer-group radius when fitting the
 * shot. Matches the spec's "+1.2m safety" callout for Auto-orbit and
 * the "+10% padding" for plane-locked shots.
 */
const AUTO_ORBIT_SAFETY_METERS = 1.2;
const PLANE_PADDING_MULT = 1.1;
/** Vertical half-FOV in radians, mirroring Viewer3DCamera's FOV_DEG=50. */
const HALF_FOV_RAD = (50 / 2) * Math.PI / 180;
/** Min distance camera-controls allows (Viewer3DCamera enforces 1m). */
const MIN_DIST = 1.05;

export interface PerformerGroupBounds {
  center: THREE.Vector3;
  radius: number;
}

/**
 * Bounding sphere of the performer group in world space. Uses each
 * performer's XZ position with a generous per-performer radius that
 * covers head height + arm span so props don't poke outside the shot.
 */
export function computeGroupBounds(
  performers: AvatarInstanceState[],
): PerformerGroupBounds {
  if (performers.length === 0) {
    return { center: new THREE.Vector3(0, TARGET_Y, 0), radius: 1.2 };
  }

  // Center = mean XZ position (Y fixed at shoulder height).
  const sum = new THREE.Vector3();
  for (const p of performers) sum.add(new THREE.Vector3(p.position.x, 0, p.position.z));
  const center = sum.divideScalar(performers.length);
  center.y = TARGET_Y;

  // Radius = farthest performer + per-performer extent (arm span + prop).
  const PER_PERFORMER_EXTENT = 1.2;
  let maxDist = 0;
  for (const p of performers) {
    const d = Math.hypot(p.position.x - center.x, p.position.z - center.z);
    if (d > maxDist) maxDist = d;
  }
  return { center, radius: maxDist + PER_PERFORMER_EXTENT };
}

/**
 * Distance at which a sphere of the given radius fills the vertical
 * frustum at FOV=50°. Matches `fitToSphere` geometry but computed
 * explicitly so callers can pad + clamp without triggering
 * camera-controls' own transition.
 */
function distanceForSphere(radius: number): number {
  return Math.max(MIN_DIST, radius / Math.sin(HALF_FOV_RAD));
}

export interface Shot {
  /** Camera position in world space. */
  eye: THREE.Vector3;
  /** Camera lookAt target in world space. */
  target: THREE.Vector3;
}

/**
 * Plane-locked shot: camera sits along the plane's normal axis,
 * framing the group bounding sphere + 10% padding.
 */
export function computePlaneShot(
  plane: Plane3,
  performers: AvatarInstanceState[],
): Shot {
  const { center, radius } = computeGroupBounds(performers);
  const padded = radius * PLANE_PADDING_MULT;
  const dist = distanceForSphere(padded);

  const eye = center.clone();
  switch (plane) {
    case "wall":
      // Wall = XY plane. Camera along -Z so the audience view matches
      // the 2D canvas (same orientation as Viewer3DCamera defaults).
      eye.z -= dist;
      break;
    case "wheel":
      // Wheel = YZ plane. Camera along +X (stage-right perspective).
      eye.x += dist;
      break;
    case "floor":
      // Floor = XZ plane. Camera above, looking straight down.
      eye.y += dist;
      break;
  }
  return { eye, target: center };
}

/**
 * Initial auto-orbit shot: camera at radius around the primary
 * performer at polar angle 65° (25° above horizon) and the current
 * azimuth derived from the group bounds' -Z axis.
 */
export function computeAutoOrbitShot(
  performers: AvatarInstanceState[],
  initialAzimuth: number,
): Shot {
  const { center, radius } = computeGroupBounds(performers);
  const padded = radius + AUTO_ORBIT_SAFETY_METERS;
  const dist = distanceForSphere(padded);

  // Polar = 65° measured from +Y (25° above horizon).
  const polar = (65 * Math.PI) / 180;
  const eye = new THREE.Vector3(
    center.x + dist * Math.sin(polar) * Math.sin(initialAzimuth),
    center.y + dist * Math.cos(polar),
    center.z + dist * Math.sin(polar) * Math.cos(initialAzimuth),
  );
  return { eye, target: center };
}

// ── Choreographer Camera Shots ────────────────────────────────────

/** Elevation angle from horizontal — 36° matches the ideal choreographer sightline. */
const CHOREO_POLAR_RAD = 36 * Math.PI / 180;
/** Extra padding so performers aren't clipped at frustum edges. */
const CHOREO_FRAMING_PADDING = 1.15;
/** Floor for solo performer — close intimate view. */
const CHOREO_MIN_DIST = 3.0;
/** Target looks at performer hip height, not the ground. */
const CHOREO_TARGET_HEIGHT = 0.55;
/** Welcome reveal starts this much further back than the final position. */
const REVEAL_DISTANCE_MULT = 1.4;
/** Reveal start target sits at this Y above stage ground (chest height). */
const REVEAL_TARGET_HEIGHT = 1.5;

const PERFORMER_BEHIND_DIST = 1.5;
const PERFORMER_LOOK_AHEAD = 3.0;
const PERFORMER_EYE_HEIGHT = 1.6;
const PERFORMER_LOOK_HEIGHT = 0.3;

/**
 * Choreographer POV: behind and above the performer group, looking
 * down at them. Scales with formation size so all performers are
 * visible regardless of count or spread.
 *
 * Camera sits along a ray from group center at CHOREO_POLAR_RAD above
 * horizontal, offset toward -Z (behind performers). Distance is
 * FOV-derived so the full bounding sphere fits in frame.
 */
export function computeChoreographerShot(
  performers: AvatarInstanceState[],
  stageGroundOffset: number,
): Shot {
  const { center, radius } = computeGroupBounds(performers);

  const paddedRadius = radius * CHOREO_FRAMING_PADDING;
  const dist = Math.max(CHOREO_MIN_DIST, distanceForSphere(paddedRadius));

  const behindDist = dist * Math.cos(CHOREO_POLAR_RAD);
  const height = dist * Math.sin(CHOREO_POLAR_RAD);

  const eye = new THREE.Vector3(
    center.x,
    stageGroundOffset + height,
    center.z - behindDist,
  );
  const target = new THREE.Vector3(
    center.x,
    stageGroundOffset + CHOREO_TARGET_HEIGHT,
    center.z,
  );
  return { eye, target };
}

/**
 * Starting position for the welcome reveal sweep. Same angle as the
 * final choreographer shot but 40% further back, with the target at
 * a generic stage-center chest height. The camera animates from here
 * into the tighter choreographer position.
 */
export function computeRevealStartShot(
  performers: AvatarInstanceState[],
  stageGroundOffset: number,
): Shot {
  const { center, radius } = computeGroupBounds(performers);
  const paddedRadius = radius * CHOREO_FRAMING_PADDING;
  const baseDist = Math.max(CHOREO_MIN_DIST, distanceForSphere(paddedRadius));
  const dist = baseDist * REVEAL_DISTANCE_MULT;

  const behindDist = dist * Math.cos(CHOREO_POLAR_RAD);
  const height = dist * Math.sin(CHOREO_POLAR_RAD);

  const eye = new THREE.Vector3(
    center.x,
    stageGroundOffset + height,
    center.z - behindDist,
  );
  const target = new THREE.Vector3(
    center.x,
    stageGroundOffset + REVEAL_TARGET_HEIGHT,
    center.z,
  );
  return { eye, target };
}

/**
 * Behind-performer POV: camera behind one performer's head, looking
 * where they look. Used when selecting a performer from the rail.
 */
export function computeBehindPerformerShot(
  performer: AvatarInstanceState,
  stageGroundOffset: number,
): Shot {
  const fa = performer.facingAngle;
  const px = performer.position.x;
  const pz = performer.position.z;

  const eye = new THREE.Vector3(
    px - Math.sin(fa) * PERFORMER_BEHIND_DIST,
    stageGroundOffset + PERFORMER_EYE_HEIGHT,
    pz - Math.cos(fa) * PERFORMER_BEHIND_DIST,
  );
  const target = new THREE.Vector3(
    px + Math.sin(fa) * PERFORMER_LOOK_AHEAD,
    stageGroundOffset + PERFORMER_LOOK_HEIGHT,
    pz + Math.cos(fa) * PERFORMER_LOOK_AHEAD,
  );
  return { eye, target };
}
