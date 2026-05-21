import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SkewDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ElementalTheme } from "../domain/elemental-theme";

export interface CardBackDomRenderOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}

/**
 * Per-hand skew data for a single beat.
 *
 * Skews modify how far a shift travels along the ring:
 *   shift+  = 1 step further (skewSteps: 1, skewDir: PLUS)
 *   shift++ = 2 steps further (skewSteps: 2, skewDir: PLUS)
 *   shift-  = 1 step shorter  (skewSteps: 1, skewDir: MINUS)
 */
export interface HandSkew {
  readonly steps: number;
  readonly direction: SkewDirection;
}

/**
 * A hand path trace is the raw spatial data: where each hand is at each point
 * in time. From 9 locations per hand we derive 8 beats (transitions).
 *
 * Skew data is optional per-beat, per-hand. Only shifts can be skewed.
 */
export interface HandPathTrace {
  blue: GridLocation[];
  red: GridLocation[];
  /** Per-beat skew overrides. Index aligns with beat index (0 = first transition). */
  skews?: { blue?: HandSkew; red?: HandSkew }[];
}

export interface InfoCardCanvasOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}

/**
 * LOOP Explainer Interface
 *
 * Generates plain-English explanations of LOOP patterns for display
 * on choreo card backs. Handles both simple LOOPs (one transformation)
 * and modular LOOPs (multiple seeds with independent nested transformations).
 *
 * The LOOPDetector answers "is this a LOOP and what components?"
 * The LOOPExplainer answers "what does this LOOP mean in plain English?"
 */
export interface SeedInfo {
  /** Display name for this seed (e.g. "AA", "KE") */
  name: string;
  /** Which beat indices (1-based) belong to each occurrence of this seed */
  beatRanges: [number, number][];
}

export interface SeedTransformation {
  seed: string;
  transformations: {
    component: LOOPComponent;
    interval: string;
    description: string;
  }[];
}

export interface LOOPExplanation {
  type: "simple" | "modular";
  seeds: SeedInfo[];
  seedTransformations: SeedTransformation[];
  cycleCount: number;
  /** Plain-English description for the card back */
  summary: string;
}

export interface PrintRenderOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  bleedPx?: number;
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;
  startPositionLayout?: "row" | "column";
  handPointsVisible: boolean;
  /** Override the default card back theme (e.g. "cosmic", "ocean") */
  theme?: string;
  /** Show QR code in an empty grid cell */
  showQRCode?: boolean;
  /** Override prop types (reads from settings when not provided) */
  bluePropType?: PropType;
  redPropType?: PropType;
  /** VTG elemental theme for front frame coloring. Omit for neutral gray. */
  elementTheme?: ElementalTheme;
  /** Left-side barter label (e.g. "QS 1:1" for deck cards) */
  leftLabel?: string;
}

export interface CardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string;
}

export interface ZipCardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string;
}

export interface FamilyRatioGroup {
  readonly ratio: string;
  readonly turns: number;
  readonly sequences: SequenceData[];
}
