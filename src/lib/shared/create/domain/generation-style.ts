/**
 * The style policy shared by every sequence-generation surface.
 *
 * UI hosts may present these settings differently, but they must agree on the
 * meaning of an untouched recipe. Keeping the baseline here prevents Generate,
 * Fuse, and future generation tools from quietly drifting apart.
 */
export type GenerationStyleAxis = "smooth" | "mixed" | "choppy";

export type GenerationMotionTypeFilter = "no-dash" | "prefer-dash" | null;

export type GenerationDashChoice =
  | Exclude<GenerationMotionTypeFilter, null>
  | "mixed";

export interface GenerationStylePolicy {
  readonly constraintPreset: GenerationStyleAxis;
  readonly handPathMode: GenerationStyleAxis;
  readonly motionTypeFilter: GenerationMotionTypeFilter;
}

/** The first-run style used by production generation tools. */
export const DEFAULT_GENERATION_STYLE: GenerationStylePolicy = Object.freeze({
  constraintPreset: "smooth",
  handPathMode: "mixed",
  motionTypeFilter: null,
});
