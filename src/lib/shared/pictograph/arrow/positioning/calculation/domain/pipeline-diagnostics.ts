/**
 * PipelineDiagnostics
 *
 * Rich metadata about which tier of the arrow positioning pipeline
 * produced the final adjustment, and what values each tier has.
 *
 * Tier priority (first match wins):
 * 1. Global Override (Firestore) - cascading Layer 3 -> 2 -> 1
 * 2. Special Placement JSON (static per-letter files)
 * 3. Prop Geometry (letter-free, prop-aware)
 * 4. Default Placement (motion-type only)
 */

export type PipelineTier =
  | "global"
  | "special-json"
  | "prop-geometry"
  | "default";

export interface TierValue {
  x: number;
  y: number;
}

export interface GlobalTierInfo {
  value: TierValue;
  layer: 1 | 2 | 3;
}

export interface SpecialJsonTierInfo {
  value: TierValue;
  /** e.g. "special/from_layer1/H_placements.json" */
  filePath: string;
  /** e.g. "(2.5, 2.5)" */
  turnsTupleKey: string;
  /** Non-null when a Firestore override exists for this key */
  firestoreOverride: {
    value: TierValue;
    original: TierValue | null;
    updatedBy: string;
  } | null;
  /**
   * A tombstone hides this whole tier (static JSON included) for this key. The
   * row still reports its static `value` so the editor can show what's hidden and
   * offer Restore, but the tier is excluded from the active-tier race — the arrow
   * places from Prop Geometry -> Default instead.
   */
  suppressed: boolean;
}

export interface PropGeometryTierInfo {
  value: TierValue;
}

export interface DefaultTierInfo {
  value: TierValue;
  /** Lookup identity so the editor can address the Firestore default field. */
  placementFrame: string;
  propType: string;
  motionType: string;
  placementKey: string;
  turns: string;
}

export interface PipelineDiagnostics {
  /** Which tier produced the final base adjustment */
  activeTier: PipelineTier;

  /** Values at each tier (null = no value found at that tier) */
  global: GlobalTierInfo | null;
  specialJson: SpecialJsonTierInfo | null;
  propGeometry: PropGeometryTierInfo | null;
  default: DefaultTierInfo | null;

  /** The raw base adjustment from the winning tier (before directional rotation) */
  baseAdjustment: TierValue;

  /** The final adjustment after directional tuple rotation */
  finalAdjustment: TierValue;
}
