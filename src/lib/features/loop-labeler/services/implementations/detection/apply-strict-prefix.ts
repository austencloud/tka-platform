import type { MergedMatch } from "./types";

export function applyStrictPrefix(matches: MergedMatch[]): MergedMatch[] {
  if (matches.length === 1) {
    return [{ ...matches[0]!, isStrict: true }];
  }
  return matches;
}
