/**
 * Config Mapper - Clean conversion between UI config and service options
 *
 * This utility provides type-safe bidirectional mapping between:
 * - UIGenerationConfig (UI state management)
 * - GenerationOptions (service layer)
 *
 * Eliminates the need for manual conversion functions and provides
 * a single source of truth for all config transformations.
 */

import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { PropType as PropTypeEnum } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type {
  DifficultyLevel,
  GenerationOptions,
} from "$lib/shared/foundation/domain/models/generation/generate-models";
import { DifficultyLevel as DifficultyEnum, PropContinuity } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { LOOPType, ROTATED_LOOP_TYPES } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
import { buildLoopSpec, parseLoopComponents, type LoopRhythm } from "$lib/shared/create/services/loop-type-utils";

/**
 * Map difficulty level number to DifficultyLevel enum
 */
export const LEVEL_TO_DIFFICULTY: Record<number, DifficultyLevel> = {
  1: DifficultyEnum.BEGINNER,
  2: DifficultyEnum.INTERMEDIATE,
  3: DifficultyEnum.ADVANCED,
  4: DifficultyEnum.SKEWED,
} as const;

/**
 * Map DifficultyLevel enum to level number (reverse lookup)
 */
export const DIFFICULTY_TO_LEVEL: Record<DifficultyLevel, number> = {
  [DifficultyEnum.BEGINNER]: 1,
  [DifficultyEnum.INTERMEDIATE]: 2,
  [DifficultyEnum.ADVANCED]: 3,
  [DifficultyEnum.SKEWED]: 4,
} as const;

/**
 * Convert level number to DifficultyLevel enum
 */
export function levelToDifficulty(level: number): DifficultyLevel {
  return LEVEL_TO_DIFFICULTY[level] || DifficultyEnum.INTERMEDIATE;
}

/**
 * Convert DifficultyLevel enum to level number
 */
export function difficultyToLevel(difficulty: DifficultyLevel): number {
  return DIFFICULTY_TO_LEVEL[difficulty] || 2;
}

/**
 * UI Configuration interface for state management
 * This is what the UI components work with directly
 */
export interface UIGenerationConfig {
  mode: string; // "freeform" | "spell"
  loopEnabled: boolean; // Orthogonal toggle - works in both freeform and spell modes
  length: number;
  level: number; // 1-4
  turnIntensity: number;
  gridMode: GridMode;
  propContinuity: string; // "continuous" | "random" - legacy, derived from constraintPreset for backwards compat
  period: string; // "halved" | "quartered"
  loopType: string; // LOOP type when loopEnabled=true

  // Per-component rhythm overrides (P3 UI sets these; absent = today's
  // behavior — rotation at `period`'s interval, inversion halved, expand mode).
  inversionInterval?: 2 | 4;
  inversionMode?: "expand" | "overlay";

  // 3-axis constraint system (replaces binary propContinuity)
  constraintPreset: "smooth" | "mixed" | "choppy"; // Prop reversal frequency
  handPathMode: "smooth" | "mixed" | "choppy"; // Hand path reversal frequency
  motionTypeFilter: "no-dash" | "prefer-dash" | null; // Dash frequency ("mixed" = null)

  // Duration rhythm template (applied automatically after generation)
  durationTemplateId: string | null;

  // Spell mode length override (null = use natural expanded length)
  spellTargetLength: number | null;
}

/**
 * Convert UI config to service-layer GenerationOptions
 * This is the main conversion function used when calling the generation service
 *
 * @param uiConfig - The UI generation configuration
 * @param propType - The prop type to use (defaults to FAN)
 * @param startEndOptions - Optional start/end position constraints
 */
export function uiConfigToGenerationOptions(
  uiConfig: UIGenerationConfig,
  propType: PropType = PropTypeEnum.FAN,
  startEndOptions?: StartEndOptions | null
): GenerationOptions {
  // Period-4 (quartered) viability is authoritative in ROTATED_LOOP_TYPES — the
  // same set loop-viability-service and card-configurator key off to decide
  // whether the Quartered card even shows. Base the mapper on that set rather
  // than substring-matching the loopType name, which drifted out of sync and
  // silently forced rotated_inverted, rotated_swapped, and mirrored_rotated_swapped
  // (all quartered-viable) down to halved, discarding the user's Quartered choice.
  const supportsQuartered = ROTATED_LOOP_TYPES.has(uiConfig.loopType as LOOPType);
  const period = supportsQuartered ? uiConfig.period : "halved";

  // Derive propContinuity from constraintPreset for backwards compat
  const derivedPropContinuity =
    uiConfig.constraintPreset === "smooth" ? PropContinuity.CONTINUOUS : PropContinuity.RANDOM;

  // When loop is enabled, use the circular generation pipeline; otherwise freeform
  const effectiveMode = uiConfig.loopEnabled ? "circular" : "freeform";

  // Compositional wire-form spec: only built when a loop is active AND a
  // loopType is chosen. `buildLoopSpec` returns null for combos with no
  // implemented mapping (same gate as generateLOOPType) — those fall back to
  // the legacy type+period path in the orchestrator, unchanged.
  const loopRhythm: LoopRhythm | undefined = uiConfig.loopEnabled
    ? {
        rotationInterval: period === "quartered" ? 4 : 2,
        inversionInterval: uiConfig.inversionInterval ?? 2,
        inversionMode: uiConfig.inversionMode ?? "expand",
      }
    : undefined;
  const loopSpecWire =
    uiConfig.loopEnabled && uiConfig.loopType && loopRhythm
      ? (buildLoopSpec(parseLoopComponents(uiConfig.loopType), loopRhythm) ?? undefined)
      : undefined;

  const options: GenerationOptions = {
    length: uiConfig.length,
    gridMode: uiConfig.gridMode,
    propType,
    difficulty: levelToDifficulty(uiConfig.level),
    mode: effectiveMode
      ? (effectiveMode as GenerationOptions["mode"])
      : undefined,
    propContinuity: derivedPropContinuity,
    turnIntensity:
      uiConfig.turnIntensity !== undefined ? uiConfig.turnIntensity : undefined,
    period: period
      ? (period as GenerationOptions["period"])
      : undefined,
    loopType: uiConfig.loopType
      ? (uiConfig.loopType as GenerationOptions["loopType"])
      : undefined,
    loopSpecWire,
    loopRhythm,

    // 3-axis constraint system
    constraintPreset: uiConfig.constraintPreset ?? undefined,
    handPathMode: uiConfig.handPathMode ?? undefined,
    motionTypeFilter: uiConfig.motionTypeFilter ?? undefined,

    // Include start/end options if provided
    blockedStartPositions: startEndOptions?.blockedStartPositions ?? undefined,
    startPosition: startEndOptions?.startPosition ?? undefined,
    endPosition: startEndOptions?.endPosition ?? undefined,
    mustContainLetters: startEndOptions?.mustContainLetters ?? undefined,
    mustNotContainLetters: startEndOptions?.mustNotContainLetters ?? undefined,

    // Start orientation overrides (engine seeds beat 0 + propagates). Orientation
    // values are already engine strings ("in"/"clock"/"out"/"counter").
    blueStartOrientation: startEndOptions?.blueStartOrientation ?? undefined,
    redStartOrientation: startEndOptions?.redStartOrientation ?? undefined,
  };
  return options;
}

/**
 * Convert service-layer GenerationOptions back to UI config
 * Useful for loading saved configurations
 */
export function generationOptionsToUIConfig(
  options: GenerationOptions,
  period: string = "halved",
  loopType: string = "rotated"
): UIGenerationConfig {
  // Derive constraintPreset from propContinuity for backwards compat
  const constraintPreset: UIGenerationConfig["constraintPreset"] =
    options.constraintPreset ?? (options.propContinuity === "random" ? "mixed" : "smooth");

  // Map "circular" back to freeform + loopEnabled for the UI
  const isCircular = options.mode === "circular";
  return {
    mode: isCircular ? "freeform" : (options.mode || "freeform"),
    loopEnabled: isCircular,
    length: options.length,
    level: difficultyToLevel(options.difficulty),
    turnIntensity: options.turnIntensity || 1.0,
    gridMode: options.gridMode,
    propContinuity: options.propContinuity || "continuous",
    period,
    loopType,
    constraintPreset,
    handPathMode: options.handPathMode ?? "mixed",
    motionTypeFilter: options.motionTypeFilter ?? null,
    durationTemplateId: null,
    spellTargetLength: null,
    inversionInterval: options.loopRhythm?.inversionInterval,
    inversionMode: options.loopRhythm?.inversionMode,
  };
}
