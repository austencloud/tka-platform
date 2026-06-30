import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export interface ChoreoCardRenderKeyInputs {
  sequence: SequenceData | null | undefined;
  bluePropType: PropType | undefined;
  redPropType: PropType | undefined;
  catDogModeEnabled: boolean;
  showStepNumbers: boolean;
  showNonRadial: boolean;
  handPointVis: "all" | "active" | "none";
  showTKA: boolean;
  showReversals: boolean;
  showTnD: boolean;
  showElemental: boolean;
  showPositions: boolean;
  showGrid: boolean;
  showBlueMotion: boolean;
  showRedMotion: boolean;
  includeStartPosition: boolean;
  effectiveColumns: number;
  darkMode: boolean;
}

export interface ChoreoCardRenderKeys {
  imageKey: string;
  contentKey: string;
  gridStableKey: string;
  renderKey: string;
}

/**
 * Single source of truth for ChoreoCard's render-trigger keys.
 *
 * ChoreoCard's onMount (to seed change-detection) and its render $effect (to
 * detect changes) both need these keys. They used to build them with duplicated
 * inline template strings; the copies drifted — `showGrid` was added to the
 * $effect's image-key `gv` segment but not to onMount's. So on the first
 * post-mount $effect run the keys never matched: classifyChange saw an "image
 * changed" with a stable grid and fired a spurious "grid-stable-image"
 * crossfade, blipping the whole grid out and back in once after the initial
 * paint. One builder used by both call sites makes that drift impossible.
 *
 * - imageKey: every prop that changes the rendered pictograph IMAGE.
 * - gridStableKey: only props that change grid STRUCTURE (count, columns,
 *   durations, start row). A crossfade-swap is only safe when this is unchanged.
 * - contentKey: imageKey + layout (columns, start toggle).
 * - renderKey: contentKey + darkMode (dark mode isn't folded into content/image).
 */
export function buildChoreoCardRenderKeys(i: ChoreoCardRenderKeyInputs): ChoreoCardRenderKeys {
  const stepLetters = i.sequence?.steps?.map((s) => s.letter ?? "?").join("") ?? "";
  const stepCount = i.sequence?.steps?.length ?? 0;
  const durationKey = i.sequence?.steps?.map((s) => s.duration ?? 1).join(",") ?? "";

  const gv = `${i.showTnD ? "1" : "0"}${i.showElemental ? "1" : "0"}${i.showPositions ? "1" : "0"}${i.showGrid ? "1" : "0"}`;
  const imageKey = `${i.sequence?.id ?? ""}-${stepLetters}-${stepCount}-${i.bluePropType}-${i.redPropType}-${i.catDogModeEnabled}-${i.showStepNumbers}-${i.showNonRadial}-${i.handPointVis}-${i.showTKA}-${i.showReversals}-${durationKey}-mv:${i.showBlueMotion ? "1" : "0"}${i.showRedMotion ? "1" : "0"}-gv:${gv}`;
  const layoutKey = `${i.includeStartPosition}-cols:${i.effectiveColumns}`;
  const contentKey = `${imageKey}-${layoutKey}`;
  const gridStableKey = `${stepCount}-${durationKey}-cols:${i.effectiveColumns}-isp:${i.includeStartPosition}`;
  const renderKey = `${contentKey}-${i.darkMode}`;

  return { imageKey, contentKey, gridStableKey, renderKey };
}
