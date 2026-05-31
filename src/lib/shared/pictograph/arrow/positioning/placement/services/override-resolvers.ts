// Pure-function override read-seam. Lets the render path consume admin
// placement overrides without importing the firebase/auth-bound singletons.
// Main thread registers resolvers backed by the repos (in each singleton's
// doInitialize); the composition worker registers resolvers backed by the
// import-clean *State classes seeded from a transferred bundle. Mirrors the
// existing defaultOverrideResolver slot in arrow-placer.ts.
import type { Point } from "fabric";
import type { GlobalAdjustmentKey } from "../../global/domain/GlobalArrowAdjustment";
import type { CascadingLookupResult } from "../../global/services/types";
import type { SpecialArrowPlacement } from "../../special-override/domain/SpecialArrowPlacement";
import type { PropGeometryKey } from "../../prop-geometry/domain/PropGeometryAdjustment";
import type { CascadingPropGeometryResult } from "../../prop-geometry/services/types";

export interface SpecialOverrideResolver {
  getOverride(key: string): Point | null;
  getFullOverride(key: string): SpecialArrowPlacement | null;
}
export type GlobalAdjustmentResolver = (
  baseKey: GlobalAdjustmentKey,
  thisPropType: string,
  otherPropType: string,
  legacyOriKey?: string,
) => CascadingLookupResult | null;
export type PropGeometryResolver = (
  key: PropGeometryKey,
) => CascadingPropGeometryResult | null;

let specialOverrideResolver: SpecialOverrideResolver | null = null;
let globalAdjustmentResolver: GlobalAdjustmentResolver | null = null;
let propGeometryResolver: PropGeometryResolver | null = null;

export function setSpecialOverrideResolver(r: SpecialOverrideResolver | null): void {
  specialOverrideResolver = r;
}
export function getSpecialOverrideResolver(): SpecialOverrideResolver | null {
  return specialOverrideResolver;
}
export function setGlobalAdjustmentResolver(r: GlobalAdjustmentResolver | null): void {
  globalAdjustmentResolver = r;
}
export function getGlobalAdjustmentResolver(): GlobalAdjustmentResolver | null {
  return globalAdjustmentResolver;
}
export function setPropGeometryResolver(r: PropGeometryResolver | null): void {
  propGeometryResolver = r;
}
export function getPropGeometryResolver(): PropGeometryResolver | null {
  return propGeometryResolver;
}
