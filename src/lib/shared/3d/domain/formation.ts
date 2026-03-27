/**
 * Formation Domain Model
 *
 * Defines performer arrangements for multi-avatar choreography.
 * Formations can be preset patterns or custom user-defined positions.
 */

/**
 * Formation type presets
 */
export type FormationPreset =
  | "grid-2x2" // Current default - 2x2 grid
  | "line" // Single row, evenly spaced
  | "circle" // Performers face center
  | "v-shape" // V/chevron formation
  | "diagonal" // Staggered diagonal line
  | "custom"; // User-defined positions

/**
 * Formation facing mode - determines how performers orient
 */
export type FacingMode =
  | "same-direction" // All face camera (current default)
  | "face-center" // All face formation center
  | "face-outward" // All face away from center
  | "custom"; // Per-performer facing angles

/**
 * 2D position for a performer in scene space
 */
export interface Position2D {
  x: number;
  z: number;
}

/**
 * Single performer's slot in a formation
 */
export interface FormationSlot {
  /** Performer index (0-3) */
  index: number;

  /** Position in scene space */
  position: Position2D;

  /** Override facing angle in radians (optional, uses facingMode if not set) */
  facingAngle?: number;
}

/**
 * Complete formation definition
 */
export interface Formation {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Preset type (or "custom" for user-defined) */
  preset: FormationPreset;

  /** How performers should face */
  facingMode: FacingMode;

  /** Position slots for each performer */
  slots: FormationSlot[];

  /** Base spacing between performers (default 2 meters) */
  spacing: number;

  /** Formation center offset from origin */
  centerOffset: Position2D;
}

/**
 * Formation with transition state for smooth animations
 */
export interface FormationTransition {
  /** Starting formation */
  from: Formation;

  /** Target formation */
  to: Formation;

  /** Progress 0-1 */
  progress: number;

  /** Duration in milliseconds */
  duration: number;

  /** Start timestamp */
  startTime: number;
}

/**
 * Default spacing between performers in meters
 */
export const DEFAULT_FORMATION_SPACING = 2.0; // 2 meters between performers

/**
 * Wall offset for positioning in meters (performers behind wall plane)
 */
export const FORMATION_WALL_OFFSET = -0.3; // 30cm behind wall plane

/**
 * Create a new formation with defaults
 */
export function createFormation(
  id: string,
  name: string,
  preset: FormationPreset,
  slots: FormationSlot[],
  options?: Partial<Pick<Formation, "facingMode" | "spacing" | "centerOffset">>
): Formation {
  return {
    id,
    name,
    preset,
    facingMode: options?.facingMode ?? "same-direction",
    slots,
    spacing: options?.spacing ?? DEFAULT_FORMATION_SPACING,
    centerOffset: options?.centerOffset ?? { x: 0, z: 0 },
  };
}

/**
 * Calculate facing angle for a slot based on facing mode
 */
export function calculateFacingAngle(
  slot: FormationSlot,
  formation: Formation
): number {
  // If slot has explicit facing, use it
  if (slot.facingAngle !== undefined) {
    return slot.facingAngle;
  }

  const center = formation.centerOffset;

  switch (formation.facingMode) {
    case "same-direction":
      // All face forward (toward camera, which is +Z direction in our setup)
      return 0;

    case "face-center":
      // Face toward formation center
      return Math.atan2(
        center.x - slot.position.x,
        center.z - slot.position.z
      );

    case "face-outward":
      // Face away from formation center
      return Math.atan2(
        slot.position.x - center.x,
        slot.position.z - center.z
      );

    case "custom":
      // Should have explicit facingAngle, default to forward
      return slot.facingAngle ?? 0;

    default:
      return 0;
  }
}

/**
 * Interpolate between two positions
 */
export function lerpPosition(
  from: Position2D,
  to: Position2D,
  t: number
): Position2D {
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

/**
 * Interpolate between two angles (handles wrapping)
 */
export function lerpAngle(from: number, to: number, t: number): number {
  // Normalize angles to [-PI, PI]
  const normalizeAngle = (a: number) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };

  const fromNorm = normalizeAngle(from);
  const toNorm = normalizeAngle(to);

  // Find shortest path
  let diff = toNorm - fromNorm;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;

  return normalizeAngle(fromNorm + diff * t);
}

/**
 * Get interpolated slot position during a transition
 */
export function getTransitionSlotPosition(
  transition: FormationTransition,
  slotIndex: number,
  easing: (t: number) => number = (t) => t
): { position: Position2D; facingAngle: number } | null {
  const fromSlot = transition.from.slots.find((s) => s.index === slotIndex);
  const toSlot = transition.to.slots.find((s) => s.index === slotIndex);

  if (!fromSlot || !toSlot) return null;

  const t = easing(transition.progress);

  const fromAngle = calculateFacingAngle(fromSlot, transition.from);
  const toAngle = calculateFacingAngle(toSlot, transition.to);

  return {
    position: lerpPosition(fromSlot.position, toSlot.position, t),
    facingAngle: lerpAngle(fromAngle, toAngle, t),
  };
}
