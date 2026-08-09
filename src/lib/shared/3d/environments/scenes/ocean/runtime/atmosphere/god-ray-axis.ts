import { Vector3, Quaternion } from "three";

/**
 * The one light axis the ocean scene agrees on.
 *
 * The scene has three things that must point the same way or the frame reads as
 * a lie: the directional sun (form and shadows), the visible god-ray columns
 * (GodRayShafts), and the spot light that actually pools on the stage
 * (OceanRuntimeSystems). Before this module each owned its own copy of the sun
 * vector and lean angle, so the hero shaft and the light it was supposed to
 * explain could drift apart silently.
 */

/** Sun position. Shared with the DirectionalLight in OceanRuntimeSystems. */
export const SUN_POS = new Vector3(10, 30, -20);

/** Water plane height above groundY. Matches WaterSurface. */
export const WATER_Y = 12;

/** Shaft column length. */
export const SHAFT_HEIGHT = 18;

/** Base column lean toward the sun, radians. */
export const LEAN = 0.26;

/**
 * Lean axis: the horizontal axis perpendicular to the sun's ground azimuth, so
 * every column tips the same way regardless of its own Y spin.
 */
const SUN_AZ = Math.atan2(SUN_POS.x, SUN_POS.z);
export const LEAN_AXIS = new Vector3(
  Math.cos(SUN_AZ),
  0,
  -Math.sin(SUN_AZ)
).normalize();

/**
 * Local +Y after the lean is applied — the direction a column actually points
 * once it tips toward the sun. Everything downstream works from this: it is how
 * a shaft's centre is solved backwards from where the shaft should LAND, and it
 * is the axis the key spot light travels down.
 */
export const COLUMN_UP = new Vector3(0, 1, 0)
  .applyQuaternion(new Quaternion().setFromAxisAngle(LEAN_AXIS, LEAN))
  .normalize();

/**
 * Where the hero shaft lands, in world XZ. The stage sits at the origin
 * (OceanStage 8x6, zOffset 0), so the key light lands on the performer.
 */
export const HERO_TARGET_XZ = { x: 0, z: 0 };

/** Stage deck top, relative to groundY: groundOffset 1.5 + elevation/height 1.0. */
export const STAGE_DECK_OFFSET = 2.5;

/**
 * Centre position for a shaft whose BOTTOM should land on `targetXZ`.
 * The column is tilted, so its centre has to sit up-lean of where it lands.
 */
export function shaftCentreForTarget(
  groundY: number,
  targetX: number,
  targetZ: number
): Vector3 {
  const half = SHAFT_HEIGHT * 0.5;
  return new Vector3(
    targetX + COLUMN_UP.x * half,
    groundY + WATER_Y - half,
    targetZ + COLUMN_UP.z * half
  );
}

/**
 * Position for the key spot light: on the hero column's axis, up at the water
 * plane, so the visible shaft and the pool it casts share one origin.
 */
export function keyLightPosition(groundY: number): Vector3 {
  const deckY = groundY + STAGE_DECK_OFFSET;
  // Travel up the column axis until we reach the water plane.
  const rise = (groundY + WATER_Y - deckY) / COLUMN_UP.y;
  return new Vector3(
    HERO_TARGET_XZ.x + COLUMN_UP.x * rise,
    deckY + COLUMN_UP.y * rise,
    HERO_TARGET_XZ.z + COLUMN_UP.z * rise
  );
}
