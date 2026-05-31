import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceEntry } from "$lib/shared/loop-labeler/domain/sequence-models";
import type { LOOPSpec } from "@tka/sequence-engine/loop";
import type { LOOPComponent, LOOPDomain } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";

/**
 * Return type of resolveLoopDisplay.
 */
export interface LoopDisplay {
  components: Set<LOOPComponent>;
  componentDomains?: Partial<Record<LOOPComponent, LOOPDomain>>;
  period: number;
  /** @deprecated Use `period` instead. */
  rotationPeriod?: Period;
  /** @deprecated Use `period` instead. */
  inversionPeriod?: Period;
}

export type LoopDisplayInput = (SequenceData | SequenceEntry) & { loopSpec?: LOOPSpec };

export type ResolveLoopDisplayFn = (input: LoopDisplayInput) => LoopDisplay;

let resolver: ResolveLoopDisplayFn | null = null;

/**
 * Register the resolveLoopDisplay implementation.
 * Called once from bootstrap.ts to avoid a reverse import (shared/ -> features/).
 */
export function registerLoopDisplayResolver(fn: ResolveLoopDisplayFn): void {
  resolver = fn;
}

export function getLoopDisplayResolver(): ResolveLoopDisplayFn {
  if (!resolver) {
    throw new Error(
      "LoopDisplayResolver not registered. Call registerLoopDisplayResolver() at app startup."
    );
  }
  return resolver;
}

export function tryGetLoopDisplayResolver(): ResolveLoopDisplayFn | null {
  return resolver;
}
