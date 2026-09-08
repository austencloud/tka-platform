/**
 * The filmstrip's frame list: pure functions only, no state.
 *
 * A pane is identified by its phase PERCENT through the anti route (0-100),
 * never by array index. "Finer" and "Coarser" insert and remove entries
 * mid-array, and an index-keyed diagnostics record would silently reattach a
 * reading to the wrong pane the moment the array reshuffles — the percent is
 * the only handle that survives a resize.
 */

/**
 * Austen's four frames, named directly against his description: the North
 * start (0%), "the thumb end needs to be in front of the avatar's face"
 * (25%), his requested "maybe 10% into that frame so we can see how it
 * moves" (35%), and the settled East endpoint (100%).
 */
export const DEFAULT_FILMSTRIP_FRAMES: readonly number[] = [0, 25, 35, 100];

/** Below this a filmstrip stops being one — always at least a start and end. */
export const MIN_FILMSTRIP_FRAMES = 2;

/**
 * Above this the pane grid asks for more live WebGL contexts than a browser
 * reliably grants a single page (`.claude/rules/resource-budget.md` territory
 * for the client, not just the dev machine).
 */
export const MAX_FILMSTRIP_FRAMES = 8;

/**
 * Where the filmstrip parks its last pane: inside the hold, one full step
 * past the reach's arrival. Reused from `DEFAULT_REACH_PHASE` in the former
 * scrubbing lab — phase exactly 1.00 is the instant of arrival, a frame where
 * the settle is still running, so 100% maps here instead.
 */
export const SETTLED_ENDPOINT_PHASE = 1.5;

/** Percent through the reach, rendered as this filmstrip names it: "35%". */
export function formatFilmstripPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
}

/**
 * The `frames=` query value back into percents: comma-separated, deduplicated,
 * sorted, clamped to 0-100, and capped at `MAX_FILMSTRIP_FRAMES`. Anything
 * that leaves fewer than `MIN_FILMSTRIP_FRAMES` usable values falls back to
 * the default four rather than rendering a broken filmstrip from a hand-edited
 * link.
 */
export function parseFramesParam(raw: string | null): number[] {
  if (!raw) return [...DEFAULT_FILMSTRIP_FRAMES];
  const parsed = raw
    .split(",")
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  const unique = Array.from(new Set(parsed)).sort((a, b) => a - b);
  if (unique.length < MIN_FILMSTRIP_FRAMES) return [...DEFAULT_FILMSTRIP_FRAMES];
  return unique.slice(0, MAX_FILMSTRIP_FRAMES);
}

/** The inverse of `parseFramesParam`, for writing the URL. */
export function formatFramesParam(frames: readonly number[]): string {
  return frames.map((percent) => formatFilmstripPercent(percent)).join(",");
}

/**
 * A frame percent to the `phaseOffsetSteps` the performer actually seeks.
 * 0-99% maps linearly onto step 1, the reach itself; 100% lands on the
 * settled hold rather than the exact step boundary, for the reason
 * `SETTLED_ENDPOINT_PHASE` documents.
 */
export function percentToPhase(percent: number): number {
  if (percent >= 100) return SETTLED_ENDPOINT_PHASE;
  return percent / 100;
}

/**
 * "Finer": one midpoint inserted into every adjacent gap, widest gaps first
 * when the cap does not leave room for all of them. Exact inverse of
 * `halveFrames` for the default 4-frame case (4 → 7 → 4).
 */
export function insertMidpoints(frames: readonly number[]): number[] {
  if (frames.length < 2) return [...frames];
  const capacity = MAX_FILMSTRIP_FRAMES - frames.length;
  if (capacity <= 0) return [...frames];

  const gaps = frames.slice(0, -1).map((value, index) => ({
    index,
    width: frames[index + 1]! - value,
  }));
  const chosen = new Set(
    [...gaps]
      .sort((a, b) => b.width - a.width)
      .slice(0, capacity)
      .map((gap) => gap.index)
  );

  const result: number[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    result.push(frames[index]!);
    if (index < frames.length - 1 && chosen.has(index)) {
      result.push((frames[index]! + frames[index + 1]!) / 2);
    }
  }
  return result;
}

/**
 * "Coarser": every other frame, always keeping the first and the last so the
 * filmstrip never loses its start or its endpoint. Exact inverse of
 * `insertMidpoints` for the default 4-frame case (7 → 4).
 */
export function halveFrames(frames: readonly number[]): number[] {
  if (frames.length <= MIN_FILMSTRIP_FRAMES) return [...frames];

  const kept = frames.filter((_, index) => index % 2 === 0);
  const last = frames[frames.length - 1]!;
  if (kept[kept.length - 1] !== last) kept.push(last);
  if (kept.length < MIN_FILMSTRIP_FRAMES) return [frames[0]!, last];
  return kept;
}
