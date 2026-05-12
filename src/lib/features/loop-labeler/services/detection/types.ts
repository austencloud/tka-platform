import type { LoopTypeDefinition } from "../../domain/constants/loop-type-definitions";

export interface ComparisonMatrix {
  halvedPairs: Map<string, string[]>;
  quarteredPairs: Map<string, string[]>;
}

export interface UnanimityResult {
  definition: LoopTypeDefinition;
  interval: 2 | 4;
  matches: boolean;
  matchedTarget: string | null;
  direction: "cw" | "ccw" | null;
  beatPairCount: number;
}

export interface MergedMatch {
  definition: LoopTypeDefinition;
  interval: 2 | 4;
  matchedTarget: string;
  direction: "cw" | "ccw" | null;
  isStrict: boolean;
}

export interface RewoundResult {
  isRewound: boolean;
}
