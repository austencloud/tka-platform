import type { UnanimityResult, MergedMatch } from "./types";

export function mergeIntervals(results: UnanimityResult[]): MergedMatch[] {
  const matched = results.filter(r => r.matches);

  const byId = new Map<string, UnanimityResult[]>();
  for (const r of matched) {
    const existing = byId.get(r.definition.id) || [];
    existing.push(r);
    byId.set(r.definition.id, existing);
  }

  const merged: MergedMatch[] = [];
  for (const [, group] of byId) {
    const best = group.find(r => r.interval === 4) || group[0]!;
    merged.push({
      definition: best.definition,
      interval: best.interval,
      matchedTarget: best.matchedTarget!,
      direction: best.direction,
      isStrict: false,
    });
  }

  return merged;
}
