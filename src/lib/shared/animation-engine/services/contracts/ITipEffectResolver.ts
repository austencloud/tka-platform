/**
 * Service interface for resolving per-tip visual effects and effort qualities.
 *
 * Wraps the pure resolution functions with map mutation helpers
 * that return new objects (immutable updates).
 */

import type {
  EffectType,
  TipEffectMap,
  TipEffortMap,
} from "../../domain/types/TipEffectTypes";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";

export interface ITipEffectResolver {
  /** Resolve the visual effect for a specific tip, cascading cell -> global -> "none". */
  resolveEffect(
    propIndex: number,
    tipIndex: number,
    cellMap: TipEffectMap | undefined,
    globalMap: TipEffectMap
  ): EffectType;

  /** Resolve the effort quality for a specific tip, cascading cell -> global -> "linear". */
  resolveEffort(
    propIndex: number,
    tipIndex: number,
    cellMap: TipEffortMap | undefined,
    globalMap: TipEffortMap
  ): EffortId;

  /** Return a new map with a cell-wide ("*") assignment. */
  setCellWide(map: TipEffectMap, effect: EffectType): TipEffectMap;

  /** Return a new map with a per-hand assignment for the given prop index. */
  setPerHand(
    map: TipEffectMap,
    propIndex: number,
    effect: EffectType
  ): TipEffectMap;

  /** Return a new map with a per-tip assignment for one tip on one prop. */
  setPerTip(
    map: TipEffectMap,
    propIndex: number,
    tipIndex: number,
    effect: EffectType
  ): TipEffectMap;
}
