/**
 * Shared props interface for all 3D prop components.
 *
 * Every prop (Staff3D, Club3D, Fan3D, etc.) receives the same set of
 * positioning/visibility props. The only thing that changes between
 * prop types is the geometry rendered inside the group.
 */

import type { PropState3D } from "../../domain/models/PropState3D";

export interface Prop3DProps {
  /** Prop state with position and rotation */
  propState: PropState3D;
  /** Prop color */
  color: "blue" | "red";
  /** Whether to show the prop */
  visible?: boolean;
  /** Prop length in scene units (default: from user proportions) */
  length?: number;
  /** Prop thickness (radius of the main body) */
  thickness?: number;
  /** Avatar world position - rotation pivot point */
  avatarPosition?: { x: number; y: number; z: number };
  /** Avatar facing angle - props rotate with avatar's body orientation */
  facingAngle?: number;
  /** Forward offset from avatar to grid center (body-local Z direction) */
  gridOffset?: number;
  /** Whether this prop belongs to the active player (hidden in first-person) */
  isActivePlayer?: boolean;
  /** Scale multiplier for "big" variants (default: 1) */
  scale?: number;
}

/** Standard color palettes matching the 2D prop colors */
export const PROP_COLORS = {
  blue: { main: "#3b82f6", dark: "#1d4ed8", light: "#60a5fa" },
  red: { main: "#ef4444", dark: "#b91c1c", light: "#f87171" },
} as const;

/** Metallic material palette (for swords, etc.) */
export const METAL_COLORS = {
  blade: "#c0c0c0",
  guard: "#ffd540",
  grip: "#8B4513",
} as const;
