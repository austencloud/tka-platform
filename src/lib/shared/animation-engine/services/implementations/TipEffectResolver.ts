/**
 * Resolves per-tip visual effects and effort qualities.
 *
 * Delegates to the pure functions in TipEffectTypes for resolution logic.
 * Map mutation methods return new objects so callers can treat maps as immutable.
 */

import type { ITipEffectResolver } from "../contracts/ITipEffectResolver";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
import {
  type EffectType,
  type TipEffectMap,
  type TipEffortMap,
  resolveEffect,
  resolveEffort,
} from "../../domain/types/TipEffectTypes";

export class TipEffectResolver implements ITipEffectResolver {
  resolveEffect(
    propIndex: number,
    tipIndex: number,
    cellMap: TipEffectMap | undefined,
    globalMap: TipEffectMap
  ): EffectType {
    return resolveEffect(propIndex, tipIndex, cellMap, globalMap);
  }

  resolveEffort(
    propIndex: number,
    tipIndex: number,
    cellMap: TipEffortMap | undefined,
    globalMap: TipEffortMap
  ): EffortId {
    return resolveEffort(propIndex, tipIndex, cellMap, globalMap);
  }

  setCellWide(map: TipEffectMap, effect: EffectType): TipEffectMap {
    return { ...map, "*": { effect } };
  }

  setPerHand(
    map: TipEffectMap,
    propIndex: number,
    effect: EffectType
  ): TipEffectMap {
    return { ...map, [`${propIndex}`]: { effect } };
  }

  setPerTip(
    map: TipEffectMap,
    propIndex: number,
    tipIndex: number,
    effect: EffectType
  ): TipEffectMap {
    return { ...map, [`${propIndex}-${tipIndex}`]: { effect } };
  }
}
