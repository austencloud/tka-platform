/**
 * How recently a creator has been active is the only honest reachability
 * signal this directory has — follower counts top out at 3 and
 * sequenceCount disagrees with the real public count, so neither can carry
 * ranking or grouping. Recency can: it's 96.4% populated and it's the field
 * that tells a visitor "this person was here yesterday" vs "signed up last
 * spring and never came back." (2026-07-25 creators discovery design doc.)
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type BandKey = "week" | "month" | "quarter" | "earlier";

/**
 * Lives here rather than in RosterBand because the panel decides whether a
 * group is a recency band at all. A filtered view or a search result set is
 * ONE group with no recency meaning, and labelling it from this map is how
 * the Following view came to render 55 people — many last seen five months
 * ago — under a header reading "This week".
 */
export const BAND_LABEL: Record<BandKey, string> = {
  week: "This week",
  month: "This month",
  quarter: "Last 90 days",
  earlier: "Earlier",
};

/**
 * A band as it lands in the roster: a recency bucket plus whoever belongs
 * to it. `mergeSmallBands` folds thin bands into this shape too, so the
 * caller always has full member lists to render, never just counts.
 */
export interface RecencyBand<T> {
  key: BandKey;
  members: T[];
}

/**
 * Sorts a creator into a recency bucket. A creator with no `lastActivityDate`
 * (2 of 56 in production) isn't a data gap to paper over — it means they
 * joined and never came back, which is exactly what "earlier" already means,
 * so it falls in with no special case.
 *
 * `now` is passed in rather than read from `Date.now()` here so the bucket
 * boundaries can be tested without mocking the clock.
 */
export function bandOf(
  lastActiveAt: Date | null | undefined,
  now: number
): BandKey {
  if (!lastActiveAt) return "earlier";

  const ageMs = now - lastActiveAt.getTime();
  if (ageMs <= 7 * DAY_MS) return "week";
  if (ageMs <= 30 * DAY_MS) return "month";
  if (ageMs <= 90 * DAY_MS) return "quarter";
  return "earlier";
}

/**
 * The four recency buckets are tuned against one snapshot of the directory,
 * so a small membership swing (a busy week, a quiet month) shouldn't be able
 * to produce a band with one or two lonely people in it. Any band under
 * `minSize` folds forward into the next band instead — its members join
 * that band and its own header disappears. The last band never folds away
 * (there's nothing after it to take its people), so it's where any leftover
 * carry always lands, even if that leaves it below `minSize` too.
 */
export function mergeSmallBands<T>(
  bands: RecencyBand<T>[],
  minSize = 3
): RecencyBand<T>[] {
  const merged: RecencyBand<T>[] = [];
  let carry: T[] = [];

  bands.forEach((band, index) => {
    const members = [...carry, ...band.members];
    const isLast = index === bands.length - 1;

    if (members.length < minSize && !isLast) {
      carry = members;
      return;
    }

    carry = [];
    merged.push({ key: band.key, members });
  });

  return merged;
}

/**
 * The recency ring is the one coloured element on a roster cell, so it has
 * to read as one scale rather than four unrelated states. Three different
 * hues (success green / info blue / warning amber) would say "status" —
 * good, notice, careful — which is not what recency means, and it would put
 * three competing colours on a page whose whole argument is calm hierarchy.
 *
 * Instead this is a single hue at four strengths: the live theme accent,
 * stepped down through `color-mix` to a neutral stroke. Fading in one
 * direction is legible as "more recent → less recent" without a legend, and
 * it survives every background theme because the hue is whatever
 * `applyThemeForBackground()` has set rather than a fixed value.
 *
 * `--theme-accent` and `--theme-stroke-strong` are set at runtime by the
 * theme pipeline (they are consumed-with-fallback across the app, never
 * declared in `app.css`). An earlier version of this function used
 * `--semantic-success` / `--semantic-info` / `--semantic-warning`, which are
 * defined nowhere outside one test route — every call silently fell through
 * to a hardcoded hex, bypassing theming entirely.
 */
export function ringToneFor(band: BandKey): string {
  const accent = "var(--theme-accent, #6366f1)";
  switch (band) {
    case "week":
      return accent;
    case "month":
      return `color-mix(in srgb, ${accent} 62%, transparent)`;
    case "quarter":
      return `color-mix(in srgb, ${accent} 34%, transparent)`;
    case "earlier":
      return "var(--theme-stroke-strong, rgba(255, 255, 255, 0.22))";
  }
}
