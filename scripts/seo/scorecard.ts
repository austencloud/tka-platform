import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SeoMeasurementConfig } from "./config";
import type { SeoCohorts } from "./cohorts";
import {
  addDays,
  aggregateFunnelMetrics,
  aggregateSearchMetrics,
  buildExperimentWindows,
  controlAdjustedDelta,
  controlAdjustedLift,
  daysBetween,
  isDateInWindow,
  matchesQueryGroup,
  type DateWindow,
  type FunnelDailyRow,
  type FunnelMetrics,
  type SearchMetricRow,
  type SearchMetrics,
} from "./core";
import type {
  AiOverviewObservation,
  FrozenControl,
  SearchCollectionDay,
} from "./warehouse";
import type { UrlInspectionSnapshot } from "./search-console";

export interface MetricComparison {
  baseline: SearchMetrics;
  current: SearchMetrics;
  raw: {
    clicks: number;
    impressions: number;
    ctrPercentagePoints: number | null;
    positionImprovement: number | null;
  };
  controlAdjusted: {
    clickLift: number | null;
    impressionLift: number | null;
    ctrPercentagePointDelta: number | null;
    positionImprovement: number | null;
  };
}

export interface EvidenceCriterion {
  id: string;
  label: string;
  status: "pass" | "fail" | "pending" | "unavailable";
  actual: number | null;
  target: number;
  unit: "count" | "ratio" | "position";
}

export interface AiOverviewAuditSnapshot {
  auditDate: string | null;
  expectedQueries: number;
  auditedQueries: number;
  queryCoverage: number;
  aiOverviewPresent: number;
  citedTka: number;
  citationRate: number | null;
  headTerm: {
    audited: boolean;
    aiOverviewPresent: boolean | null;
    citedTka: boolean | null;
    citationRank: number | null;
  };
}

export interface ReputationSnapshot {
  reviewCadenceDays: number;
  lastReviewedDate: string | null;
  reviewDueDate: string | null;
  reviewOverdue: boolean;
  independentSites: number;
  composerSpecificSites: number;
  linkedSites: number;
  targets: {
    independentSites: number;
    composerSpecificSites: number;
    linkedSites: number;
  };
  sources: Array<{
    id: string;
    publisher: string;
    sourceUrl: string;
    sourceType:
      | "editorial"
      | "event"
      | "grant"
      | "partner"
      | "review"
      | "directory";
    mentionScope: "tka" | "composer";
    status: "active" | "lost";
    publishedDate: string | null;
    verifiedDate: string;
    linksToTka: boolean;
    targetUrl: string | null;
    context: string;
  }>;
}

export interface SeoScorecard {
  version: 1;
  experimentId: string;
  protocol: {
    configVersion: SeoMeasurementConfig["version"];
    amendedDate: string;
    amendmentReason: string;
  };
  generatedAt: string;
  generatedDate: string;
  dataThrough: string;
  phase: ReturnType<typeof buildExperimentWindows>["phase"];
  performanceSource: "api" | "bulk";
  evaluationMode: SeoMeasurementConfig["experiment"]["evaluationMode"];
  experimentDates: {
    deploymentDate: string | null;
    indexedDate: string | null;
    indexedDateSource: "configured" | "inspection" | "pending";
    instrumentationStartDate: string | null;
  };
  windows: ReturnType<typeof buildExperimentWindows>;
  cohorts: {
    frozen: boolean;
    treatmentPageCount: number;
    controlCandidateCount: number;
    frozenControls: FrozenControl[];
    inspectionSampleCount: number;
  };
  dataQuality: {
    expectedSearchDays: number;
    collectedSearchDays: number;
    missingSearchDates: string[];
    truncatedSearchDates: string[];
    searchDataComplete: boolean;
    expectedPostHogDays: number;
    collectedPostHogDays: number;
    missingPostHogDates: string[];
    postHogDataComplete: boolean;
  };
  search: {
    baseline: SearchMetrics;
    primary: MetricComparison | null;
    confirmation: MetricComparison | null;
    queryGroups: Array<{
      id: string;
      label: string;
      baseline: SearchMetrics;
      primary: SearchMetrics | null;
      confirmation: SearchMetrics | null;
    }>;
    headTerm: {
      baseline: SearchMetrics;
      primary: SearchMetrics | null;
      confirmation: SearchMetrics | null;
    };
    primaryTopQueries: Array<SearchMetrics & { query: string }>;
  };
  acquisition: {
    baseline: FunnelMetrics;
    primary: FunnelMetrics | null;
    confirmation: FunnelMetrics | null;
    instrumentationStartDate: string | null;
    primaryConversionMeasurable: boolean;
    primaryDataComplete: boolean;
    confirmationDataComplete: boolean;
    conversionComparableToBaseline: boolean;
  };
  indexability: {
    inspected: number;
    indexed: number;
    indexedRate: number | null;
    canonicalMatches: number;
    latestCaptureDate: string | null;
    expected: number;
    sampleComplete: boolean;
    freshForEvaluation: boolean;
  };
  aiOverview: {
    baseline: AiOverviewAuditSnapshot;
    current: AiOverviewAuditSnapshot;
    citationRateChange: number | null;
  };
  reputation: ReputationSnapshot;
  milestones: EvidenceCriterion[];
  decision: {
    status:
      | "baseline"
      | "awaiting_indexing"
      | "collecting"
      | "incomplete_evidence"
      | "below_target"
      | "primary_target_met"
      | "confirmed_target_met";
    evaluationWindow: "primary" | "confirmation" | null;
    criteria: EvidenceCriterion[];
  };
}

interface ScorecardInput {
  config: SeoMeasurementConfig;
  generatedAt: string;
  generatedDate: string;
  dataThrough: string;
  cohorts: SeoCohorts;
  controls: readonly FrozenControl[];
  searchRows: readonly SearchMetricRow[];
  funnelRows: readonly FunnelDailyRow[];
  collectionDays: readonly SearchCollectionDay[];
  postHogCollectionDays: readonly SearchCollectionDay[];
  inspections: readonly UrlInspectionSnapshot[];
  aiObservations: readonly AiOverviewObservation[];
  cohortFrozen: boolean;
  indexedDateSource?: "configured" | "inspection" | "pending";
}

function effectiveWindow(
  window: DateWindow | null,
  dataThrough: string
): DateWindow | null {
  if (!window || dataThrough < window.start) return null;
  const end = dataThrough < window.end ? dataThrough : window.end;
  return {
    start: window.start,
    end,
    days: daysBetween(window.start, end) + 1,
    complete: window.complete,
  };
}

function instrumentedWindow(
  window: DateWindow | null,
  instrumentationStart: string | null
): DateWindow | null {
  if (!window || !instrumentationStart || instrumentationStart > window.end) {
    return null;
  }
  const start =
    instrumentationStart > window.start ? instrumentationStart : window.start;
  return {
    start,
    end: window.end,
    days: daysBetween(start, window.end) + 1,
    complete: window.complete,
  };
}

function datesInWindow(window: DateWindow): string[] {
  return Array.from({ length: window.days }, (_, index) =>
    addDays(window.start, index)
  );
}

function searchMetricsForPages(
  rows: readonly SearchMetricRow[],
  window: DateWindow,
  pages: ReadonlySet<string>
): SearchMetrics {
  return aggregateSearchMetrics(
    rows,
    window,
    (row) => row.query === null && pages.has(row.page)
  );
}

function searchComparison(options: {
  rows: readonly SearchMetricRow[];
  baseline: DateWindow;
  current: DateWindow;
  treatmentPages: ReadonlySet<string>;
  controlPages: readonly string[];
}): MetricComparison {
  const baseline = searchMetricsForPages(
    options.rows,
    options.baseline,
    options.treatmentPages
  );
  const current = searchMetricsForPages(
    options.rows,
    options.current,
    options.treatmentPages
  );
  const controlMetrics = options.controlPages.map((page) => ({
    pre: searchMetricsForPages(options.rows, options.baseline, new Set([page])),
    post: searchMetricsForPages(options.rows, options.current, new Set([page])),
  }));

  const ctrDelta = controlAdjustedDelta({
    treatmentPre: baseline.ctr,
    treatmentPost: current.ctr,
    controlPairs: controlMetrics.map((metrics) => ({
      pre: metrics.pre.ctr,
      post: metrics.post.ctr,
    })),
  });
  const positionDelta = controlAdjustedDelta({
    treatmentPre: baseline.position,
    treatmentPost: current.position,
    controlPairs: controlMetrics.map((metrics) => ({
      pre: metrics.pre.position,
      post: metrics.post.position,
    })),
  });

  return {
    baseline,
    current,
    raw: {
      clicks: current.clicks - baseline.clicks,
      impressions: current.impressions - baseline.impressions,
      ctrPercentagePoints:
        baseline.ctr === null || current.ctr === null
          ? null
          : (current.ctr - baseline.ctr) * 100,
      positionImprovement:
        baseline.position === null || current.position === null
          ? null
          : baseline.position - current.position,
    },
    controlAdjusted: {
      clickLift: controlAdjustedLift({
        treatmentPre: baseline.clicks,
        treatmentPost: current.clicks,
        controlPairs: controlMetrics.map((metrics) => ({
          pre: metrics.pre.clicks,
          post: metrics.post.clicks,
        })),
      }),
      impressionLift: controlAdjustedLift({
        treatmentPre: baseline.impressions,
        treatmentPost: current.impressions,
        controlPairs: controlMetrics.map((metrics) => ({
          pre: metrics.pre.impressions,
          post: metrics.post.impressions,
        })),
      }),
      ctrPercentagePointDelta: ctrDelta === null ? null : ctrDelta * 100,
      positionImprovement: positionDelta === null ? null : -positionDelta,
    },
  };
}

function queryMetrics(options: {
  rows: readonly SearchMetricRow[];
  window: DateWindow;
  treatmentPages: ReadonlySet<string>;
  group: { match: "exact" | "contains"; terms: readonly string[] };
}): SearchMetrics {
  return aggregateSearchMetrics(
    options.rows,
    options.window,
    (row) =>
      options.treatmentPages.has(row.page) &&
      matchesQueryGroup(row.query, options.group)
  );
}

function topQueries(
  rows: readonly SearchMetricRow[],
  window: DateWindow | null,
  treatmentPages: ReadonlySet<string>
): Array<SearchMetrics & { query: string }> {
  if (!window) return [];
  const byQuery = new Map<
    string,
    { clicks: number; impressions: number; weightedPosition: number }
  >();

  for (const row of rows) {
    if (
      !row.query ||
      !treatmentPages.has(row.page) ||
      !isDateInWindow(row.date, window)
    ) {
      continue;
    }
    const current = byQuery.get(row.query) ?? {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.position * row.impressions;
    byQuery.set(row.query, current);
  }

  return [...byQuery.entries()]
    .map(([query, metrics]) => ({
      query,
      clicks: metrics.clicks,
      impressions: metrics.impressions,
      ctr:
        metrics.impressions > 0 ? metrics.clicks / metrics.impressions : null,
      position:
        metrics.impressions > 0
          ? metrics.weightedPosition / metrics.impressions
          : null,
    }))
    .sort(
      (left, right) =>
        right.impressions - left.impressions ||
        left.query.localeCompare(right.query)
    )
    .slice(0, 20);
}

function summarizeIndexability(
  rows: readonly UrlInspectionSnapshot[],
  expectedUrls: readonly string[],
  evaluationWindow: DateWindow | null
) {
  const expected = new Set(expectedUrls);
  const relevantRows = rows.filter((row) => expected.has(row.inspectionUrl));
  const latestCaptureDate = relevantRows.reduce<string | null>(
    (latest, row) =>
      latest === null || row.captureDate > latest ? row.captureDate : latest,
    null
  );
  const latestRows = latestCaptureDate
    ? relevantRows.filter((row) => row.captureDate === latestCaptureDate)
    : [];
  const byUrl = new Map(latestRows.map((row) => [row.inspectionUrl, row]));
  const inspectedRows = [...byUrl.values()];
  const indexed = inspectedRows.filter((row) => row.verdict === "PASS").length;
  const canonicalMatches = inspectedRows.filter(
    (row) => row.googleCanonical === row.inspectionUrl
  ).length;
  const sampleComplete = expected.size > 0 && byUrl.size === expected.size;
  const freshForEvaluation = Boolean(
    evaluationWindow &&
    latestCaptureDate &&
    latestCaptureDate >= evaluationWindow.end
  );

  return {
    inspected: byUrl.size,
    indexed,
    indexedRate: byUrl.size > 0 ? indexed / byUrl.size : null,
    canonicalMatches,
    latestCaptureDate,
    expected: expected.size,
    sampleComplete,
    freshForEvaluation,
  };
}

function latestAuditDateInWindow(
  rows: readonly AiOverviewObservation[],
  window: DateWindow | null
): string | null {
  if (!window) return null;
  return rows.reduce<string | null>((latest, row) => {
    if (!isDateInWindow(row.observedDate, window)) return latest;
    return latest === null || row.observedDate > latest
      ? row.observedDate
      : latest;
  }, null);
}

function summarizeAiAudit(
  expectedQueries: readonly string[],
  rows: readonly AiOverviewObservation[],
  headTerm: string,
  auditDate: string | null
): AiOverviewAuditSnapshot {
  const auditRows = auditDate
    ? rows.filter((row) => row.observedDate === auditDate)
    : [];
  const expected = new Set(
    expectedQueries.map((query) => query.toLocaleLowerCase("en-US"))
  );
  const auditedQueries = new Set(
    auditRows
      .map((row) => row.query.toLocaleLowerCase("en-US"))
      .filter((query) => expected.has(query))
  ).size;
  const aiOverviewPresent = auditRows.filter(
    (row) => row.aiOverviewPresent
  ).length;
  const citedTka = auditRows.filter((row) => row.citedTka).length;
  const normalizedHeadTerm = headTerm.toLocaleLowerCase("en-US");
  const headTermRow = auditRows.find(
    (row) => row.query.toLocaleLowerCase("en-US") === normalizedHeadTerm
  );

  return {
    auditDate,
    expectedQueries: expected.size,
    auditedQueries,
    queryCoverage: expected.size > 0 ? auditedQueries / expected.size : 0,
    aiOverviewPresent,
    citedTka,
    citationRate: aiOverviewPresent > 0 ? citedTka / aiOverviewPresent : null,
    headTerm: {
      audited: Boolean(headTermRow),
      aiOverviewPresent: headTermRow?.aiOverviewPresent ?? null,
      citedTka: headTermRow?.citedTka ?? null,
      citationRank: headTermRow?.rankInCitations ?? null,
    },
  };
}

function summarizeAiOverview(options: {
  expectedQueries: readonly string[];
  rows: readonly AiOverviewObservation[];
  headTerm: string;
  baselineWindow: DateWindow;
  evaluationWindow: DateWindow | null;
}) {
  const baseline = summarizeAiAudit(
    options.expectedQueries,
    options.rows,
    options.headTerm,
    latestAuditDateInWindow(options.rows, options.baselineWindow)
  );
  const current = summarizeAiAudit(
    options.expectedQueries,
    options.rows,
    options.headTerm,
    latestAuditDateInWindow(options.rows, options.evaluationWindow)
  );

  return {
    baseline,
    current,
    citationRateChange:
      baseline.citationRate === null || current.citationRate === null
        ? null
        : current.citationRate - baseline.citationRate,
  };
}

function criterion(options: {
  id: string;
  label: string;
  actual: number | null;
  target: number;
  unit: EvidenceCriterion["unit"];
  ready: boolean;
  nullStatus?: "fail" | "unavailable";
  pass: (actual: number, target: number) => boolean;
}): EvidenceCriterion {
  return {
    id: options.id,
    label: options.label,
    actual: options.actual,
    target: options.target,
    unit: options.unit,
    status: !options.ready
      ? "pending"
      : options.actual === null
        ? (options.nullStatus ?? "unavailable")
        : options.pass(options.actual, options.target)
          ? "pass"
          : "fail",
  };
}

function buildDecision(options: {
  config: SeoMeasurementConfig;
  phase: SeoScorecard["phase"];
  cohortFrozen: boolean;
  searchDataComplete: boolean;
  primary: MetricComparison | null;
  confirmation: MetricComparison | null;
  primaryFunnel: FunnelMetrics | null;
  confirmationFunnel: FunnelMetrics | null;
  primaryConversionMeasurable: boolean;
  confirmationConversionMeasurable: boolean;
  primaryPostHogDataComplete: boolean;
  confirmationPostHogDataComplete: boolean;
  indexingDataComplete: boolean;
  indexedRate: number | null;
}): SeoScorecard["decision"] {
  if (options.phase === "baseline") {
    return { status: "baseline", evaluationWindow: null, criteria: [] };
  }
  if (options.phase === "awaiting_indexing") {
    return {
      status: "awaiting_indexing",
      evaluationWindow: null,
      criteria: [],
    };
  }

  const useConfirmation = options.phase === "confirmed";
  const comparison = useConfirmation ? options.confirmation : options.primary;
  const funnel = useConfirmation
    ? options.confirmationFunnel
    : options.primaryFunnel;
  const conversionMeasurable = useConfirmation
    ? options.confirmationConversionMeasurable
    : options.primaryConversionMeasurable;
  const postHogDataComplete = useConfirmation
    ? options.confirmationPostHogDataComplete
    : options.primaryPostHogDataComplete;
  const ready = useConfirmation
    ? options.phase === "confirmed"
    : options.phase === "primary_complete" || options.phase === "confirmed";
  const searchCriteria: EvidenceCriterion[] =
    options.config.experiment.evaluationMode === "visibility_emergence"
      ? [
          criterion({
            id: "treatment_impressions",
            label: "Treatment impressions available for a decision",
            actual: comparison?.current.impressions ?? null,
            target:
              options.config.successCriteria
                .minimumTreatmentImpressionsForDecision,
            unit: "count",
            ready,
            pass: (actual, target) => actual >= target,
          }),
          criterion({
            id: "treatment_clicks",
            label: "Treatment clicks available for a decision",
            actual: comparison?.current.clicks ?? null,
            target:
              options.config.successCriteria.minimumTreatmentClicksForDecision,
            unit: "count",
            ready,
            pass: (actual, target) => actual >= target,
          }),
        ]
      : [
          criterion({
            id: "treatment_impressions",
            label: "Treatment impressions available for a decision",
            actual: comparison?.current.impressions ?? null,
            target:
              options.config.successCriteria
                .minimumTreatmentImpressionsForDecision,
            unit: "count",
            ready,
            pass: (actual, target) => actual >= target,
          }),
          criterion({
            id: "adjusted_impression_lift",
            label: "Control-adjusted impression lift",
            actual: comparison?.controlAdjusted.impressionLift ?? null,
            target:
              options.config.successCriteria
                .minimumControlAdjustedImpressionLift,
            unit: "ratio",
            ready,
            pass: (actual, target) => actual >= target,
          }),
          criterion({
            id: "adjusted_click_lift",
            label: "Control-adjusted click lift",
            actual: comparison?.controlAdjusted.clickLift ?? null,
            target:
              options.config.successCriteria.minimumControlAdjustedClickLift,
            unit: "ratio",
            ready,
            pass: (actual, target) => actual >= target,
          }),
        ];
  const criteria: EvidenceCriterion[] = [
    ...searchCriteria,
    criterion({
      id: "indexed_sample_rate",
      label: "Indexed treatment sample",
      actual: options.indexedRate,
      target: options.config.successCriteria.minimumIndexedSampleRate,
      unit: "ratio",
      ready: ready && options.indexingDataComplete,
      pass: (actual, target) => actual >= target,
    }),
    criterion({
      id: "organic_activation_rate",
      label: "Organic Composer activation rate",
      actual: conversionMeasurable ? (funnel?.activationRate ?? null) : null,
      target: options.config.successCriteria.minimumOrganicActivationRate,
      unit: "ratio",
      ready: ready && conversionMeasurable && postHogDataComplete,
      pass: (actual, target) => actual >= target,
    }),
  ];

  if (!ready) {
    return {
      status: "collecting",
      evaluationWindow: useConfirmation ? "confirmation" : "primary",
      criteria,
    };
  }
  if (!options.cohortFrozen || !options.searchDataComplete) {
    return {
      status: "incomplete_evidence",
      evaluationWindow: useConfirmation ? "confirmation" : "primary",
      criteria,
    };
  }
  if (criteria.some((item) => item.status === "fail")) {
    return {
      status: "below_target",
      evaluationWindow: useConfirmation ? "confirmation" : "primary",
      criteria,
    };
  }
  if (
    criteria.some(
      (item) => item.status === "pending" || item.status === "unavailable"
    )
  ) {
    return {
      status: "incomplete_evidence",
      evaluationWindow: useConfirmation ? "confirmation" : "primary",
      criteria,
    };
  }

  return {
    status: useConfirmation ? "confirmed_target_met" : "primary_target_met",
    evaluationWindow: useConfirmation ? "confirmation" : "primary",
    criteria,
  };
}

function sourceHost(sourceUrl: string): string {
  return new URL(sourceUrl).hostname
    .toLocaleLowerCase("en-US")
    .replace(/^www\./, "");
}

export function buildReputationSnapshot(
  config: SeoMeasurementConfig,
  generatedDate: string
): ReputationSnapshot {
  const activeSources = config.reputation.sources.filter(
    (source) => source.status === "active"
  );
  const independentSites = new Set(
    activeSources.map((source) => sourceHost(source.sourceUrl))
  );
  const composerSpecificSites = new Set(
    activeSources
      .filter((source) => source.mentionScope === "composer")
      .map((source) => sourceHost(source.sourceUrl))
  );
  const linkedSites = new Set(
    activeSources
      .filter((source) => source.linksToTka)
      .map((source) => sourceHost(source.sourceUrl))
  );
  const lastReviewedDate = config.reputation.lastReviewedDate;
  const reviewDueDate = addDays(
    lastReviewedDate,
    config.reputation.reviewCadenceDays
  );

  return {
    reviewCadenceDays: config.reputation.reviewCadenceDays,
    lastReviewedDate,
    reviewDueDate,
    reviewOverdue: generatedDate > reviewDueDate,
    independentSites: independentSites.size,
    composerSpecificSites: composerSpecificSites.size,
    linkedSites: linkedSites.size,
    targets: {
      independentSites: config.milestoneCriteria.minimumIndependentSites,
      composerSpecificSites:
        config.milestoneCriteria.minimumComposerSpecificSites,
      linkedSites: config.milestoneCriteria.minimumLinkedSites,
    },
    sources: config.reputation.sources.map((source) => ({ ...source })),
  };
}

function buildMilestones(options: {
  config: SeoMeasurementConfig;
  phase: SeoScorecard["phase"];
  headTermPrimary: SearchMetrics | null;
  headTermConfirmation: SearchMetrics | null;
  aiOverview: SeoScorecard["aiOverview"];
  reputation: ReputationSnapshot;
}): EvidenceCriterion[] {
  const headTerm =
    options.phase === "confirmed"
      ? options.headTermConfirmation
      : options.headTermPrimary;

  return [
    criterion({
      id: "head_term_position",
      label: 'Average position for "flow arts software"',
      actual: headTerm?.position ?? null,
      target: options.config.milestoneCriteria.maximumHeadTermPosition,
      unit: "position",
      ready: headTerm !== null,
      nullStatus: "fail",
      pass: (actual, target) => actual <= target,
    }),
    criterion({
      id: "ai_overview_citation_rate",
      label: "TKA citation rate when an AI Overview appears",
      actual: options.aiOverview.current.citationRate,
      target: options.config.milestoneCriteria.minimumAiCitationRate,
      unit: "ratio",
      ready: options.aiOverview.current.queryCoverage === 1,
      pass: (actual, target) => actual >= target,
    }),
    criterion({
      id: "head_term_ai_citation_rank",
      label: 'TKA citation rank for "flow arts software" AI Overview',
      actual:
        options.aiOverview.current.headTerm.aiOverviewPresent &&
        options.aiOverview.current.headTerm.citedTka
          ? options.aiOverview.current.headTerm.citationRank
          : null,
      target: options.config.milestoneCriteria.maximumHeadTermAiCitationRank,
      unit: "position",
      ready: options.aiOverview.current.headTerm.audited,
      pass: (actual, target) => actual <= target,
    }),
    criterion({
      id: "independent_sites",
      label: "Known independent sites mentioning TKA or Composer",
      actual: options.reputation.independentSites,
      target: options.reputation.targets.independentSites,
      unit: "count",
      ready: true,
      pass: (actual, target) => actual >= target,
    }),
    criterion({
      id: "composer_specific_sites",
      label: "Known independent sites describing Composer",
      actual: options.reputation.composerSpecificSites,
      target: options.reputation.targets.composerSpecificSites,
      unit: "count",
      ready: true,
      pass: (actual, target) => actual >= target,
    }),
    criterion({
      id: "linked_sites",
      label: "Known independent sites linking to TKA",
      actual: options.reputation.linkedSites,
      target: options.reputation.targets.linkedSites,
      unit: "count",
      ready: true,
      pass: (actual, target) => actual >= target,
    }),
  ];
}

export function buildSeoScorecard(input: ScorecardInput): SeoScorecard {
  const windows = buildExperimentWindows(
    input.config.experiment,
    input.dataThrough
  );
  const primaryWindow = effectiveWindow(windows.primary, input.dataThrough);
  const confirmationWindow = effectiveWindow(
    windows.confirmation,
    input.dataThrough
  );
  const treatmentPages = new Set(input.cohorts.treatmentPages);
  const controlPages = input.controls.map((control) => control.page);
  const baselineSearch = searchMetricsForPages(
    input.searchRows,
    windows.baseline,
    treatmentPages
  );
  const primary = primaryWindow
    ? searchComparison({
        rows: input.searchRows,
        baseline: windows.baseline,
        current: primaryWindow,
        treatmentPages,
        controlPages,
      })
    : null;
  const confirmation = confirmationWindow
    ? searchComparison({
        rows: input.searchRows,
        baseline: windows.baseline,
        current: confirmationWindow,
        treatmentPages,
        controlPages,
      })
    : null;
  const headTermGroup = input.config.queryGroups.find(
    (group) => group.id === "head_term"
  );
  if (!headTermGroup) {
    throw new Error(
      'SEO measurement config requires a "head_term" query group'
    );
  }

  const queryGroups = input.config.queryGroups.map((group) => ({
    id: group.id,
    label: group.label,
    baseline: queryMetrics({
      rows: input.searchRows,
      window: windows.baseline,
      treatmentPages,
      group,
    }),
    primary: primaryWindow
      ? queryMetrics({
          rows: input.searchRows,
          window: primaryWindow,
          treatmentPages,
          group,
        })
      : null,
    confirmation: confirmationWindow
      ? queryMetrics({
          rows: input.searchRows,
          window: confirmationWindow,
          treatmentPages,
          group,
        })
      : null,
  }));
  const headTerm = queryGroups.find((group) => group.id === "head_term")!;
  const baselineFunnel = aggregateFunnelMetrics(
    input.funnelRows,
    windows.baseline
  );
  const instrumentationStart = input.config.experiment.instrumentationStartDate;
  const primaryFunnelWindow = instrumentedWindow(
    primaryWindow,
    instrumentationStart
  );
  const confirmationFunnelWindow = instrumentedWindow(
    confirmationWindow,
    instrumentationStart
  );
  const primaryFunnel = primaryFunnelWindow
    ? aggregateFunnelMetrics(input.funnelRows, primaryFunnelWindow)
    : null;
  const confirmationFunnel = confirmationFunnelWindow
    ? aggregateFunnelMetrics(input.funnelRows, confirmationFunnelWindow)
    : null;
  const primaryConversionMeasurable = primaryFunnelWindow !== null;
  const confirmationConversionMeasurable = confirmationFunnelWindow !== null;
  const conversionComparableToBaseline = Boolean(
    instrumentationStart && instrumentationStart <= windows.baseline.start
  );
  const postHogCollectionMap = new Map(
    input.postHogCollectionDays.map((day) => [day.date, day])
  );
  const primaryPostHogDataComplete = Boolean(
    primaryConversionMeasurable &&
    primaryFunnelWindow &&
    datesInWindow(primaryFunnelWindow).every((date) =>
      postHogCollectionMap.has(date)
    )
  );
  const confirmationPostHogDataComplete = Boolean(
    confirmationConversionMeasurable &&
    confirmationFunnelWindow &&
    datesInWindow(confirmationFunnelWindow).every((date) =>
      postHogCollectionMap.has(date)
    )
  );
  const aiEvaluationWindow =
    windows.phase === "confirmed" ? confirmationWindow : primaryWindow;
  const indexability = summarizeIndexability(
    input.inspections,
    input.cohorts.inspectionSample,
    aiEvaluationWindow
  );
  const aiOverview = summarizeAiOverview({
    expectedQueries: input.config.aiOverviewQueries,
    rows: input.aiObservations.filter(
      (row) =>
        row.locale === input.config.aiOverviewAudit.locale &&
        row.device === input.config.aiOverviewAudit.device &&
        row.market === input.config.aiOverviewAudit.market
    ),
    headTerm: headTermGroup.terms[0]!,
    baselineWindow: windows.baseline,
    evaluationWindow: aiEvaluationWindow,
  });
  const expectedDates = new Set(datesInWindow(windows.baseline));
  for (const window of [primaryWindow, confirmationWindow]) {
    if (!window) continue;
    for (const date of datesInWindow(window)) expectedDates.add(date);
  }
  const collectionMap = new Map(
    input.collectionDays.map((day) => [day.date, day])
  );
  const missingSearchDates = [...expectedDates]
    .filter((date) => !collectionMap.has(date))
    .sort();
  const truncatedSearchDates = [...expectedDates]
    .filter((date) => collectionMap.get(date)?.truncated)
    .sort();
  const searchDataComplete =
    missingSearchDates.length === 0 && truncatedSearchDates.length === 0;
  const expectedPostHogDates = new Set<string>();
  if (instrumentationStart) {
    for (const window of [
      windows.baseline,
      primaryWindow,
      confirmationWindow,
    ]) {
      if (!window) continue;
      for (const date of datesInWindow(window)) {
        if (date >= instrumentationStart) expectedPostHogDates.add(date);
      }
    }
  }
  const missingPostHogDates = [...expectedPostHogDates]
    .filter((date) => !postHogCollectionMap.has(date))
    .sort();
  const postHogDataComplete =
    expectedPostHogDates.size > 0 && missingPostHogDates.length === 0;
  const reputation = buildReputationSnapshot(input.config, input.generatedDate);
  const milestones = buildMilestones({
    config: input.config,
    phase: windows.phase,
    headTermPrimary: headTerm.primary,
    headTermConfirmation: headTerm.confirmation,
    aiOverview,
    reputation,
  });

  const decision = buildDecision({
    config: input.config,
    phase: windows.phase,
    cohortFrozen: input.cohortFrozen,
    searchDataComplete,
    primary,
    confirmation,
    primaryFunnel,
    confirmationFunnel,
    primaryConversionMeasurable,
    confirmationConversionMeasurable,
    primaryPostHogDataComplete,
    confirmationPostHogDataComplete,
    indexingDataComplete:
      indexability.sampleComplete && indexability.freshForEvaluation,
    indexedRate: indexability.indexedRate,
  });

  return {
    version: 1,
    experimentId: input.config.experimentId,
    protocol: {
      configVersion: input.config.version,
      amendedDate: input.config.protocolAmendment.date,
      amendmentReason: input.config.protocolAmendment.reason,
    },
    generatedAt: input.generatedAt,
    generatedDate: input.generatedDate,
    dataThrough: input.dataThrough,
    phase: windows.phase,
    performanceSource: input.config.warehouse.performanceSource,
    evaluationMode: input.config.experiment.evaluationMode,
    experimentDates: {
      deploymentDate: input.config.experiment.deploymentDate,
      indexedDate: input.config.experiment.indexedDate,
      indexedDateSource:
        input.indexedDateSource ??
        (input.config.experiment.indexedDate ? "configured" : "pending"),
      instrumentationStartDate:
        input.config.experiment.instrumentationStartDate,
    },
    windows,
    cohorts: {
      frozen: input.cohortFrozen,
      treatmentPageCount: input.cohorts.treatmentPages.length,
      controlCandidateCount: input.cohorts.controlCandidates.length,
      frozenControls: [...input.controls],
      inspectionSampleCount: input.cohorts.inspectionSample.length,
    },
    dataQuality: {
      expectedSearchDays: expectedDates.size,
      collectedSearchDays: expectedDates.size - missingSearchDates.length,
      missingSearchDates,
      truncatedSearchDates,
      searchDataComplete,
      expectedPostHogDays: expectedPostHogDates.size,
      collectedPostHogDays:
        expectedPostHogDates.size - missingPostHogDates.length,
      missingPostHogDates,
      postHogDataComplete,
    },
    search: {
      baseline: baselineSearch,
      primary,
      confirmation,
      queryGroups,
      headTerm: {
        baseline: headTerm.baseline,
        primary: headTerm.primary,
        confirmation: headTerm.confirmation,
      },
      primaryTopQueries: topQueries(
        input.searchRows,
        primaryWindow,
        treatmentPages
      ),
    },
    acquisition: {
      baseline: baselineFunnel,
      primary: primaryFunnel,
      confirmation: confirmationFunnel,
      instrumentationStartDate: instrumentationStart,
      primaryConversionMeasurable,
      primaryDataComplete: primaryPostHogDataComplete,
      confirmationDataComplete: confirmationPostHogDataComplete,
      conversionComparableToBaseline,
    },
    indexability,
    aiOverview,
    reputation,
    milestones,
    decision,
  };
}

function formatNumber(value: number | null, digits = 1): string {
  return value === null ? "Not available" : value.toFixed(digits);
}

function formatRatio(value: number | null): string {
  return value === null ? "Not available" : `${(value * 100).toFixed(1)}%`;
}

function comparisonRows(
  comparison: MetricComparison | null,
  evaluationMode: SeoScorecard["evaluationMode"]
): string {
  if (!comparison) return "No comparison window is open yet.";
  if (evaluationMode === "visibility_emergence") {
    return [
      "| Metric | Pre-launch | Current | Absolute change |",
      "| --- | ---: | ---: | ---: |",
      `| Impressions | ${comparison.baseline.impressions} | ${comparison.current.impressions} | ${comparison.raw.impressions} |`,
      `| Clicks | ${comparison.baseline.clicks} | ${comparison.current.clicks} | ${comparison.raw.clicks} |`,
      `| CTR | ${formatRatio(comparison.baseline.ctr)} | ${formatRatio(comparison.current.ctr)} | ${formatNumber(comparison.raw.ctrPercentagePoints)} pp |`,
      `| Average position | ${formatNumber(comparison.baseline.position)} | ${formatNumber(comparison.current.position)} | ${formatNumber(comparison.raw.positionImprovement)} places better |`,
    ].join("\n");
  }
  return [
    "| Metric | Baseline | Current | Control-adjusted change |",
    "| --- | ---: | ---: | ---: |",
    `| Impressions | ${comparison.baseline.impressions} | ${comparison.current.impressions} | ${formatRatio(comparison.controlAdjusted.impressionLift)} |`,
    `| Clicks | ${comparison.baseline.clicks} | ${comparison.current.clicks} | ${formatRatio(comparison.controlAdjusted.clickLift)} |`,
    `| CTR | ${formatRatio(comparison.baseline.ctr)} | ${formatRatio(comparison.current.ctr)} | ${formatNumber(comparison.controlAdjusted.ctrPercentagePointDelta)} pp |`,
    `| Average position | ${formatNumber(comparison.baseline.position)} | ${formatNumber(comparison.current.position)} | ${formatNumber(comparison.controlAdjusted.positionImprovement)} places better |`,
  ].join("\n");
}

export function renderScorecardMarkdown(scorecard: SeoScorecard): string {
  const activeComparison =
    scorecard.decision.evaluationWindow === "confirmation"
      ? scorecard.search.confirmation
      : scorecard.search.primary;
  const criteria =
    scorecard.decision.criteria.length === 0
      ? "No required decision checks are due yet."
      : [
          "| Test | Status | Actual | Target |",
          "| --- | --- | ---: | ---: |",
          ...scorecard.decision.criteria.map((item) => {
            const formatter =
              item.unit === "ratio" ? formatRatio : formatNumber;
            return `| ${item.label} | ${item.status} | ${formatter(item.actual)} | ${formatter(item.target)} |`;
          }),
        ].join("\n");
  const milestones = [
    "| Milestone | Status | Actual | Target |",
    "| --- | --- | ---: | ---: |",
    ...scorecard.milestones.map((item) => {
      const formatter = item.unit === "ratio" ? formatRatio : formatNumber;
      return `| ${item.label} | ${item.status} | ${formatter(item.actual)} | ${formatter(item.target)} |`;
    }),
  ].join("\n");
  const reputationSources = scorecard.reputation.sources
    .filter((source) => source.status === "active")
    .map(
      (source) =>
        `- [${source.publisher}](${source.sourceUrl}): ${source.context}`
    )
    .join("\n");

  return `# Flow Arts Software SEO scorecard

Generated: ${scorecard.generatedAt}

Data through: ${scorecard.dataThrough} (Pacific Time)

Experiment phase: ${scorecard.phase}

Evaluation mode: ${scorecard.evaluationMode}

Protocol version: ${scorecard.protocol.configVersion} (amended ${scorecard.protocol.amendedDate})

Decision: ${scorecard.decision.status}

Deployment date: ${scorecard.experimentDates.deploymentDate ?? "not registered"}

Indexed date: ${scorecard.experimentDates.indexedDate ?? "not detected"} (${scorecard.experimentDates.indexedDateSource})

## Search performance

${comparisonRows(activeComparison, scorecard.evaluationMode)}

## Required decision checks

${criteria}

## Campaign milestones

${milestones}

## Independent reputation

- Known independent sites: ${scorecard.reputation.independentSites}/${scorecard.reputation.targets.independentSites}
- Composer-specific sites: ${scorecard.reputation.composerSpecificSites}/${scorecard.reputation.targets.composerSpecificSites}
- Independent sites linking to TKA: ${scorecard.reputation.linkedSites}/${scorecard.reputation.targets.linkedSites}
- Last reviewed: ${scorecard.reputation.lastReviewedDate ?? "not reviewed"}
- Next review due: ${scorecard.reputation.reviewDueDate ?? "now"}

${reputationSources || "No active independent sources are logged."}

## Data quality

- Search source: ${scorecard.performanceSource}
- Search days collected: ${scorecard.dataQuality.collectedSearchDays}/${scorecard.dataQuality.expectedSearchDays}
- Missing dates: ${scorecard.dataQuality.missingSearchDates.join(", ") || "none"}
- Truncated dates: ${scorecard.dataQuality.truncatedSearchDates.join(", ") || "none"}
- PostHog days collected: ${scorecard.dataQuality.collectedPostHogDays}/${scorecard.dataQuality.expectedPostHogDays}
- Missing PostHog dates: ${scorecard.dataQuality.missingPostHogDates.join(", ") || "none"}
- Frozen ${scorecard.evaluationMode === "visibility_emergence" ? "reference pages" : "controls"}: ${scorecard.cohorts.frozenControls.length}
- Experiment cohorts frozen: ${scorecard.cohorts.frozen ? "yes" : "no"}

## Indexing and AI Overviews

- URL Inspection sample collected: ${scorecard.indexability.inspected}/${scorecard.indexability.expected}
- Latest inspection date: ${scorecard.indexability.latestCaptureDate ?? "not collected"}
- Inspection is fresh for the evaluation window: ${scorecard.indexability.freshForEvaluation ? "yes" : "no"}
- Indexed inspection sample: ${scorecard.indexability.indexed}/${scorecard.indexability.expected}
- Canonical matches: ${scorecard.indexability.canonicalMatches}/${scorecard.indexability.expected}
- Pre-launch AI audit: ${scorecard.aiOverview.baseline.auditDate ?? "not collected"} (${scorecard.aiOverview.baseline.auditedQueries}/${scorecard.aiOverview.baseline.expectedQueries} queries; comparison context only)
- Current-window AI audit: ${scorecard.aiOverview.current.auditDate ?? "not collected"} (${scorecard.aiOverview.current.auditedQueries}/${scorecard.aiOverview.current.expectedQueries} queries)
- TKA citation rate when an AI Overview appeared: ${formatRatio(scorecard.aiOverview.current.citationRate)}
- Citation-rate change from baseline: ${formatRatio(scorecard.aiOverview.citationRateChange)}
- TKA citation rank for "flow arts software": ${formatNumber(scorecard.aiOverview.current.headTerm.citationRank, 0)}

## Organic Composer behavior

- Primary conversion measurement active: ${scorecard.acquisition.primaryConversionMeasurable ? "yes" : "no"}
- Comparable to the pre-deployment baseline: ${scorecard.acquisition.conversionComparableToBaseline ? "yes" : "no"}
- Primary organic sessions: ${scorecard.acquisition.primary?.organicComposerSessions ?? "Not available"}
- Primary activation rate: ${formatRatio(scorecard.acquisition.primary?.activationRate ?? null)}
`;
}

export async function writeScorecardFiles(
  scorecard: SeoScorecard,
  outputDirectory = "seo-reports"
): Promise<{ jsonPath: string; markdownPath: string }> {
  const directory = resolve(process.cwd(), outputDirectory);
  await mkdir(directory, { recursive: true });
  const baseName = `${scorecard.experimentId}-${scorecard.generatedDate}`;
  const jsonPath = resolve(directory, `${baseName}.json`);
  const markdownPath = resolve(directory, `${baseName}.md`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderScorecardMarkdown(scorecard), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}
