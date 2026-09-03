/**
 * Interval arithmetic for boot attribution.
 *
 * Scene boot is heavily concurrent: 200+ texture decodes run at once while
 * GLBs are still downloading. Summing durations therefore says nothing about
 * elapsed time — 210 decodes totalling 4,000 ms can occupy 300 ms of wall
 * clock. Every question worth asking about boot ("how much of the window was
 * this?") is a question about the UNION of intervals, so that math lives here,
 * pure and testable, instead of being re-derived per category.
 */

export interface BootInterval {
  start: number;
  end: number;
}

export interface IntervalStats {
  /** How many intervals were recorded. */
  count: number;
  /** Elapsed time covered by at least one interval. */
  wallMs: number;
  /** Sum of every interval, which exceeds wallMs under concurrency. */
  totalMs: number;
  /** totalMs / wallMs — 1 means strictly sequential. */
  concurrency: number;
  /** Peak simultaneous intervals. */
  maxInFlight: number;
}

function byStart(a: BootInterval, b: BootInterval): number {
  return a.start - b.start;
}

/** Merge overlapping intervals into an ascending, disjoint set. */
export function mergeIntervals(
  intervals: readonly BootInterval[]
): BootInterval[] {
  const valid = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end))
    .filter((i) => i.end > i.start)
    .sort(byStart);
  const merged: BootInterval[] = [];
  for (const interval of valid) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
      continue;
    }
    merged.push({ start: interval.start, end: interval.end });
  }
  return merged;
}

/** Total elapsed time covered by at least one interval. */
export function unionMs(intervals: readonly BootInterval[]): number {
  let total = 0;
  for (const interval of mergeIntervals(intervals)) {
    total += interval.end - interval.start;
  }
  return total;
}

/**
 * Peak simultaneous intervals. An interval ending exactly as another begins
 * does not count as overlap, so ends are processed before starts.
 */
export function maxInFlight(intervals: readonly BootInterval[]): number {
  const events: { at: number; delta: number }[] = [];
  for (const interval of intervals) {
    if (!(interval.end > interval.start)) continue;
    events.push({ at: interval.start, delta: 1 });
    events.push({ at: interval.end, delta: -1 });
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

/** Restrict intervals to a window, dropping anything fully outside it. */
export function clipIntervals(
  intervals: readonly BootInterval[],
  start: number,
  end: number
): BootInterval[] {
  const clipped: BootInterval[] = [];
  for (const interval of intervals) {
    const from = Math.max(interval.start, start);
    const to = Math.min(interval.end, end);
    if (to > from) clipped.push({ start: from, end: to });
  }
  return clipped;
}

/**
 * Time covered by `source` but not by `remove`. This is what separates "the
 * main thread was busy parsing" from "the main thread was busy uploading":
 * subtract the parts already explained.
 */
export function subtractIntervals(
  source: readonly BootInterval[],
  remove: readonly BootInterval[]
): BootInterval[] {
  const holes = mergeIntervals(remove);
  const result: BootInterval[] = [];
  for (const interval of mergeIntervals(source)) {
    let cursor = interval.start;
    for (const hole of holes) {
      if (hole.end <= cursor) continue;
      if (hole.start >= interval.end) break;
      if (hole.start > cursor) {
        result.push({ start: cursor, end: Math.min(hole.start, interval.end) });
      }
      cursor = Math.max(cursor, hole.end);
      if (cursor >= interval.end) break;
    }
    if (cursor < interval.end) result.push({ start: cursor, end: interval.end });
  }
  return result;
}

export function summarizeIntervals(
  intervals: readonly BootInterval[]
): IntervalStats {
  let totalMs = 0;
  let count = 0;
  for (const interval of intervals) {
    if (!(interval.end > interval.start)) continue;
    totalMs += interval.end - interval.start;
    count += 1;
  }
  const wallMs = unionMs(intervals);
  return {
    count,
    wallMs,
    totalMs,
    concurrency: wallMs > 0 ? totalMs / wallMs : 0,
    maxInFlight: maxInFlight(intervals),
  };
}
