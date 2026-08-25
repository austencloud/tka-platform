import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { galleryStepCount } from "$lib/shared/browse/services/gallery-render-input";
import { calculateGalleryAspectRatio } from "$lib/shared/render/services/layout-calculator";

/** Resolves the start-position layout the gallery card will actually render
 *  with. The shelf passes the card's own resolver so the curation's aspect
 *  math and the rendered artwork can never disagree. */
export type StartPositionLayoutResolver = (
  stepCount: number
) => "row" | "column";

const defaultLayout: StartPositionLayoutResolver = () => "row";

/**
 * The card shape the loading skeletons reserve. The gallery's public work is
 * dominated by 16-step sequences, so that cohort normally wins the pick below;
 * reserving its shape keeps the shelf from resizing when the cards arrive.
 */
export const SHELF_CARD_ASPECT_RATIO = calculateGalleryAspectRatio(16, "row");

/** A gallery card's height is its column width divided by this ratio. Cards
 *  from different ratios cannot share a row without one towering over the
 *  rest, so the shelf draws its whole set from one ratio. */
function cardAspectRatio(
  sequence: SequenceData,
  layout: StartPositionLayoutResolver
): number {
  const steps = galleryStepCount(sequence);
  return calculateGalleryAspectRatio(steps, layout(steps));
}

function ratioKey(ratio: number): string {
  return ratio.toFixed(3);
}

function byQuality(a: SequenceData, b: SequenceData): number {
  const thumbDelta =
    Number((b.thumbnails?.length ?? 0) > 0) -
    Number((a.thumbnails?.length ?? 0) > 0);
  if (thumbDelta !== 0) return thumbDelta;

  const popularityDelta =
    (b.publicPerformanceCount ?? 0) - (a.publicPerformanceCount ?? 0);
  if (popularityDelta !== 0) return popularityDelta;

  return (b.dateAdded?.getTime() ?? 0) - (a.dateAdded?.getTime() ?? 0);
}

/**
 * Pick the public-gallery sequences shown on the presentation shelf.
 *
 * The shelf is a glance at the real gallery, so the pick favors sequences a
 * visitor can actually see immediately: cloud thumbnails first, locally
 * renderable steps second. One card per display word — the gallery groups
 * same-word variations behind a pill, and a marketing shelf has no pill.
 * Popular work leads (publicPerformanceCount), then the newest additions.
 *
 * Every returned card shares one aspect ratio. Card height is width divided by
 * a ratio the step count fixes, so a mixed set renders a row where one card is
 * twice its neighbours. The largest cohort that can fill the shelf wins, which
 * also makes the shelf representative of what the gallery mostly holds; ties go
 * to the wider ratio, whose shorter cards keep two rows on screen. A gallery
 * too small to fill one cohort falls back to the nearest ratios rather than
 * returning a short shelf.
 */
export function pickShelfSequences(
  sequences: readonly SequenceData[],
  count: number,
  startPositionLayout: StartPositionLayoutResolver = defaultLayout
): SequenceData[] {
  const renderable = sequences.filter(
    (sequence) =>
      (sequence.thumbnails?.length ?? 0) > 0 ||
      (sequence.steps?.length ?? 0) > 0
  );

  const seenWords = new Set<string>();
  const distinct: SequenceData[] = [];
  for (const sequence of [...renderable].sort(byQuality)) {
    const word = simplifyRepeatedWord(sequence.word || sequence.name || "");
    if (word && seenWords.has(word)) continue;
    if (word) seenWords.add(word);
    distinct.push(sequence);
  }

  const cohorts = new Map<string, { ratio: number; entries: SequenceData[] }>();
  for (const sequence of distinct) {
    const ratio = cardAspectRatio(sequence, startPositionLayout);
    const key = ratioKey(ratio);
    const cohort = cohorts.get(key) ?? { ratio, entries: [] };
    cohort.entries.push(sequence);
    cohorts.set(key, cohort);
  }

  const best = [...cohorts.values()].sort((a, b) => {
    const fills =
      Number(b.entries.length >= count) - Number(a.entries.length >= count);
    if (fills !== 0) return fills;

    const size = b.entries.length - a.entries.length;
    if (size !== 0) return size;

    return b.ratio - a.ratio;
  })[0];

  if (!best) return [];
  if (best.entries.length >= count) return best.entries.slice(0, count);

  const filler = distinct
    .filter((sequence) => !best.entries.includes(sequence))
    .sort(
      (a, b) =>
        Math.abs(cardAspectRatio(a, startPositionLayout) - best.ratio) -
        Math.abs(cardAspectRatio(b, startPositionLayout) - best.ratio)
    );

  return [...best.entries, ...filler].slice(0, count);
}
