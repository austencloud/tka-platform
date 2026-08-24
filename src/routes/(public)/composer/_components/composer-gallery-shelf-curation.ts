import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

/**
 * Pick the public-gallery sequences shown on the presentation shelf.
 *
 * The shelf is a glance at the real gallery, so the pick favors sequences a
 * visitor can actually see immediately: cloud thumbnails first, locally
 * renderable steps second. One card per display word — the gallery groups
 * same-word variations behind a pill, and a marketing shelf has no pill.
 * Popular work leads (publicPerformanceCount), then the newest additions.
 */
export function pickShelfSequences(
  sequences: readonly SequenceData[],
  count: number
): SequenceData[] {
  const renderable = sequences.filter(
    (sequence) =>
      (sequence.thumbnails?.length ?? 0) > 0 ||
      (sequence.steps?.length ?? 0) > 0
  );

  const ranked = [...renderable].sort((a, b) => {
    const thumbDelta =
      Number((b.thumbnails?.length ?? 0) > 0) -
      Number((a.thumbnails?.length ?? 0) > 0);
    if (thumbDelta !== 0) return thumbDelta;

    const popularityDelta =
      (b.publicPerformanceCount ?? 0) - (a.publicPerformanceCount ?? 0);
    if (popularityDelta !== 0) return popularityDelta;

    return (b.dateAdded?.getTime() ?? 0) - (a.dateAdded?.getTime() ?? 0);
  });

  const seenWords = new Set<string>();
  const picked: SequenceData[] = [];
  for (const sequence of ranked) {
    const word = simplifyRepeatedWord(sequence.word || sequence.name || "");
    if (word && seenWords.has(word)) continue;
    if (word) seenWords.add(word);
    picked.push(sequence);
    if (picked.length >= count) break;
  }
  return picked;
}
