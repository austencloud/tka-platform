export interface DateWindow {
  start: string;
  end: string;
  days: number;
  complete: boolean;
}

export interface CalendarDateRange {
  startDate: string;
  endDate: string;
}

export interface ExperimentDates {
  deploymentDate: string | null;
  indexedDate: string | null;
  instrumentationStartDate: string | null;
  baselineDays: number;
  primaryDays: number;
  confirmationDays: number;
}

export interface ExperimentWindows {
  phase:
    | "baseline"
    | "awaiting_indexing"
    | "primary_collecting"
    | "primary_complete"
    | "confirmed";
  baseline: DateWindow;
  primary: DateWindow | null;
  confirmation: DateWindow | null;
}

export interface SearchMetricRow {
  date: string;
  page: string;
  query: string | null;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface SearchMetrics {
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface ControlMatch {
  page: string;
  score: number;
  correlation: number;
  baselineImpressions: number;
  normalizedSlopeDifference: number;
}

export interface FunnelDailyRow {
  date: string;
  organicComposerSessions: number;
  composerOpenedSessions: number;
  activatedSessions: number;
  completedSessions: number;
  lcpP75: number | null;
  inpP75: number | null;
  clsP75: number | null;
}

export interface FunnelMetrics {
  organicComposerSessions: number;
  composerOpenedSessions: number;
  activatedSessions: number;
  completedSessions: number;
  openRate: number | null;
  activationRate: number | null;
  completionRate: number | null;
  medianDailyLcpP75: number | null;
  medianDailyInpP75: number | null;
  medianDailyClsP75: number | null;
}

const DAY_MS = 86_400_000;

export function calendarDateInTimeZone(
  instant: Date,
  timeZone: string
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  if (!values.year || !values.month || !values.day) {
    throw new Error(`Could not format a calendar date in ${timeZone}`);
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected YYYY-MM-DD, received "${value}"`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid calendar date "${value}"`);
  }
  return parsed;
}

export function addDays(value: string, days: number): string {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function contiguousDateRanges(
  dates: readonly string[]
): CalendarDateRange[] {
  const sorted = [...new Set(dates)].sort();
  const ranges: CalendarDateRange[] = [];

  for (const date of sorted) {
    parseCalendarDate(date);
    const current = ranges.at(-1);
    if (current && addDays(current.endDate, 1) === date) {
      current.endDate = date;
    } else {
      ranges.push({ startDate: date, endDate: date });
    }
  }

  return ranges;
}

export function daysBetween(start: string, end: string): number {
  return Math.round(
    (parseCalendarDate(end).getTime() - parseCalendarDate(start).getTime()) /
      DAY_MS
  );
}

export function rangeEndingAt(end: string, days: number): DateWindow {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("Window length must be a positive integer");
  }
  return {
    start: addDays(end, -(days - 1)),
    end,
    days,
    complete: true,
  };
}

function windowFrom(
  start: string,
  days: number,
  dataThrough: string
): DateWindow {
  const end = addDays(start, days - 1);
  return {
    start,
    end,
    days,
    complete: dataThrough >= end,
  };
}

export function buildExperimentWindows(
  dates: ExperimentDates,
  dataThrough: string
): ExperimentWindows {
  parseCalendarDate(dataThrough);

  if (!dates.deploymentDate) {
    return {
      phase: "baseline",
      baseline: rangeEndingAt(dataThrough, dates.baselineDays),
      primary: null,
      confirmation: null,
    };
  }

  const baseline = rangeEndingAt(
    addDays(dates.deploymentDate, -1),
    dates.baselineDays
  );

  if (!dates.indexedDate) {
    return {
      phase: "awaiting_indexing",
      baseline,
      primary: null,
      confirmation: null,
    };
  }

  const primary = windowFrom(dates.indexedDate, dates.primaryDays, dataThrough);
  const confirmation = windowFrom(
    addDays(primary.end, 1),
    dates.confirmationDays,
    dataThrough
  );

  const phase = !primary.complete
    ? "primary_collecting"
    : !confirmation.complete
      ? "primary_complete"
      : "confirmed";

  return { phase, baseline, primary, confirmation };
}

export function isDateInWindow(date: string, window: DateWindow): boolean {
  return date >= window.start && date <= window.end;
}

export function aggregateSearchMetrics(
  rows: readonly SearchMetricRow[],
  window: DateWindow,
  predicate: (row: SearchMetricRow) => boolean = () => true
): SearchMetrics {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;

  for (const row of rows) {
    if (!isDateInWindow(row.date, window) || !predicate(row)) continue;
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: impressions > 0 ? weightedPosition / impressions : null,
  };
}

function dailyImpressions(
  rows: readonly SearchMetricRow[],
  window: DateWindow,
  predicate: (row: SearchMetricRow) => boolean
): number[] {
  const byDate = new Map<string, number>();
  for (let offset = 0; offset < window.days; offset += 1) {
    byDate.set(addDays(window.start, offset), 0);
  }

  for (const row of rows) {
    if (!isDateInWindow(row.date, window) || !predicate(row)) continue;
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.impressions);
  }

  return [...byDate.values()];
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearson(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index]! - leftMean;
    const rightDelta = right[index]! - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta ** 2;
    rightSquares += rightDelta ** 2;
  }

  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator === 0 ? 0 : numerator / denominator;
}

function normalizedSlope(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const xMean = (values.length - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < values.length; index += 1) {
    numerator += (index - xMean) * (values[index]! - yMean);
    denominator += (index - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  return slope / Math.max(yMean, 1);
}

export function selectMatchedControls(options: {
  rows: readonly SearchMetricRow[];
  baseline: DateWindow;
  treatmentPages: ReadonlySet<string>;
  candidatePages: readonly string[];
  minimumImpressions: number;
  maximumControls: number;
  minimumCorrelation: number;
}): ControlMatch[] {
  const treatmentSeries = dailyImpressions(
    options.rows,
    options.baseline,
    (row) => row.query === null && options.treatmentPages.has(row.page)
  );
  const treatmentTotal = treatmentSeries.reduce((sum, value) => sum + value, 0);
  const treatmentSlope = normalizedSlope(treatmentSeries);

  return [...new Set(options.candidatePages)]
    .filter((page) => !options.treatmentPages.has(page))
    .map((page): ControlMatch => {
      const series = dailyImpressions(
        options.rows,
        options.baseline,
        (row) => row.query === null && row.page === page
      );
      const baselineImpressions = series.reduce((sum, value) => sum + value, 0);
      const correlation = pearson(treatmentSeries, series);
      const normalizedSlopeDifference = Math.abs(
        treatmentSlope - normalizedSlope(series)
      );
      const volumePenalty = Math.abs(
        Math.log((baselineImpressions + 1) / (treatmentTotal + 1))
      );
      const score =
        0.55 * ((correlation + 1) / 2) +
        0.25 * Math.exp(-volumePenalty) +
        0.2 * Math.exp(-normalizedSlopeDifference * options.baseline.days);

      return {
        page,
        score,
        correlation,
        baselineImpressions,
        normalizedSlopeDifference,
      };
    })
    .filter(
      (match) =>
        match.baselineImpressions >= options.minimumImpressions &&
        match.correlation >= options.minimumCorrelation
    )
    .sort(
      (left, right) =>
        right.score - left.score || left.page.localeCompare(right.page)
    )
    .slice(0, options.maximumControls);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function controlAdjustedLift(options: {
  treatmentPre: number;
  treatmentPost: number;
  controlPairs: readonly { pre: number; post: number }[];
}): number | null {
  if (options.treatmentPre <= 0) return null;

  const controlGrowth = median(
    options.controlPairs
      .filter((pair) => pair.pre > 0)
      .map((pair) => pair.post / pair.pre)
  );
  if (controlGrowth === null || controlGrowth <= 0) return null;

  return options.treatmentPost / options.treatmentPre / controlGrowth - 1;
}

export function controlAdjustedDelta(options: {
  treatmentPre: number | null;
  treatmentPost: number | null;
  controlPairs: readonly { pre: number | null; post: number | null }[];
}): number | null {
  if (options.treatmentPre === null || options.treatmentPost === null) {
    return null;
  }

  const controlDelta = median(
    options.controlPairs
      .filter(
        (pair): pair is { pre: number; post: number } =>
          pair.pre !== null && pair.post !== null
      )
      .map((pair) => pair.post - pair.pre)
  );
  if (controlDelta === null) return null;

  return options.treatmentPost - options.treatmentPre - controlDelta;
}

function pooledPercentile(
  rows: readonly FunnelDailyRow[],
  key: "lcpP75" | "inpP75" | "clsP75"
): number | null {
  const values = rows
    .map((row) => row[key])
    .filter(
      (value): value is number => value !== null && Number.isFinite(value)
    );
  return median(values);
}

export function aggregateFunnelMetrics(
  rows: readonly FunnelDailyRow[],
  window: DateWindow
): FunnelMetrics {
  const included = rows.filter((row) => isDateInWindow(row.date, window));
  const totals = included.reduce(
    (sum, row) => ({
      organicComposerSessions:
        sum.organicComposerSessions + row.organicComposerSessions,
      composerOpenedSessions:
        sum.composerOpenedSessions + row.composerOpenedSessions,
      activatedSessions: sum.activatedSessions + row.activatedSessions,
      completedSessions: sum.completedSessions + row.completedSessions,
    }),
    {
      organicComposerSessions: 0,
      composerOpenedSessions: 0,
      activatedSessions: 0,
      completedSessions: 0,
    }
  );

  return {
    ...totals,
    openRate:
      totals.organicComposerSessions > 0
        ? totals.composerOpenedSessions / totals.organicComposerSessions
        : null,
    activationRate:
      totals.organicComposerSessions > 0
        ? totals.activatedSessions / totals.organicComposerSessions
        : null,
    completionRate:
      totals.organicComposerSessions > 0
        ? totals.completedSessions / totals.organicComposerSessions
        : null,
    medianDailyLcpP75: pooledPercentile(included, "lcpP75"),
    medianDailyInpP75: pooledPercentile(included, "inpP75"),
    medianDailyClsP75: pooledPercentile(included, "clsP75"),
  };
}

export function matchesQueryGroup(
  query: string | null,
  group: { match: "exact" | "contains"; terms: readonly string[] }
): boolean {
  if (!query) return false;
  const normalized = query.trim().toLocaleLowerCase("en-US");
  return group.terms.some((term) => {
    const candidate = term.trim().toLocaleLowerCase("en-US");
    return group.match === "exact"
      ? normalized === candidate
      : normalized.includes(candidate);
  });
}

export function pathFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/$/, "") || "/";
    return path;
  } catch {
    return null;
  }
}
