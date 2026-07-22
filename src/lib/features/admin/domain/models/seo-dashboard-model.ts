import { z } from "zod";

const nullableNumber = z.number().finite().nullable();

const searchMetricsSchema = z.object({
  clicks: z.number().finite(),
  impressions: z.number().finite(),
  ctr: nullableNumber,
  position: nullableNumber,
});

const funnelMetricsSchema = z.object({
  organicComposerSessions: z.number().finite(),
  composerOpenedSessions: z.number().finite(),
  activatedSessions: z.number().finite(),
  completedSessions: z.number().finite(),
  openRate: nullableNumber,
  activationRate: nullableNumber,
  completionRate: nullableNumber,
  medianDailyLcpP75: nullableNumber,
  medianDailyInpP75: nullableNumber,
  medianDailyClsP75: nullableNumber,
});

const dateWindowSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  days: z.number().int().positive(),
  complete: z.boolean(),
});

const auditSnapshotSchema = z.object({
  auditDate: z.string().nullable(),
  expectedQueries: z.number().int().nonnegative(),
  auditedQueries: z.number().int().nonnegative(),
  queryCoverage: z.number().finite(),
  aiOverviewPresent: z.number().int().nonnegative(),
  citedTka: z.number().int().nonnegative(),
  citationRate: nullableNumber,
  headTerm: z.object({
    audited: z.boolean(),
    aiOverviewPresent: z.boolean().nullable(),
    citedTka: z.boolean().nullable(),
    citationRank: z.number().int().positive().nullable(),
  }),
});

export const seoPhaseSchema = z.enum([
  "baseline",
  "awaiting_indexing",
  "primary_collecting",
  "primary_complete",
  "confirmed",
]);

export const seoDecisionStatusSchema = z.enum([
  "baseline",
  "awaiting_indexing",
  "collecting",
  "incomplete_evidence",
  "below_target",
  "primary_target_met",
  "confirmed_target_met",
]);

export const seoDashboardSnapshotSchema = z.object({
  version: z.literal(1),
  experimentId: z.string().min(1),
  generatedAt: z.string().min(1),
  generatedDate: z.string().min(1),
  dataThrough: z.string().min(1),
  phase: seoPhaseSchema,
  performanceSource: z.enum(["api", "bulk"]),
  evaluationMode: z
    .enum(["relative_lift", "visibility_emergence"])
    .default("relative_lift"),
  currentWindow: z.enum(["primary", "confirmation"]).nullable(),
  experimentDates: z.object({
    deploymentDate: z.string().nullable(),
    indexedDate: z.string().nullable(),
    indexedDateSource: z.enum(["configured", "inspection", "pending"]),
    instrumentationStartDate: z.string().nullable(),
  }),
  windows: z.object({
    baseline: dateWindowSchema,
    primary: dateWindowSchema.nullable(),
    confirmation: dateWindowSchema.nullable(),
  }),
  cohorts: z.object({
    frozen: z.boolean(),
    treatmentPageCount: z.number().int().nonnegative(),
    controlCandidateCount: z.number().int().nonnegative(),
    frozenControlCount: z.number().int().nonnegative(),
    inspectionSampleCount: z.number().int().nonnegative(),
  }),
  dataQuality: z.object({
    expectedSearchDays: z.number().int().nonnegative(),
    collectedSearchDays: z.number().int().nonnegative(),
    missingSearchDates: z.array(z.string()),
    truncatedSearchDates: z.array(z.string()),
    searchDataComplete: z.boolean(),
    expectedPostHogDays: z.number().int().nonnegative(),
    collectedPostHogDays: z.number().int().nonnegative(),
    missingPostHogDates: z.array(z.string()),
    postHogDataComplete: z.boolean(),
  }),
  search: z.object({
    baseline: searchMetricsSchema,
    current: searchMetricsSchema.nullable(),
    controlAdjusted: z
      .object({
        clickLift: nullableNumber,
        impressionLift: nullableNumber,
        ctrPercentagePointDelta: nullableNumber,
        positionImprovement: nullableNumber,
      })
      .nullable(),
  }),
  headTerm: z.object({
    baseline: searchMetricsSchema,
    current: searchMetricsSchema.nullable(),
  }),
  acquisition: z.object({
    baseline: funnelMetricsSchema,
    current: funnelMetricsSchema.nullable(),
    conversionMeasurable: z.boolean(),
    currentDataComplete: z.boolean(),
  }),
  queryGroups: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      baseline: searchMetricsSchema,
      current: searchMetricsSchema.nullable(),
    })
  ),
  topQueries: z.array(searchMetricsSchema.extend({ query: z.string().min(1) })),
  indexability: z.object({
    inspected: z.number().int().nonnegative(),
    indexed: z.number().int().nonnegative(),
    indexedRate: nullableNumber,
    canonicalMatches: z.number().int().nonnegative(),
    latestCaptureDate: z.string().nullable(),
    expected: z.number().int().nonnegative(),
    sampleComplete: z.boolean(),
    freshForEvaluation: z.boolean(),
  }),
  aiOverview: z.object({
    baseline: auditSnapshotSchema,
    current: auditSnapshotSchema,
    citationRateChange: nullableNumber,
  }),
  decision: z.object({
    status: seoDecisionStatusSchema,
    criteria: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        status: z.enum(["pass", "fail", "pending", "unavailable"]),
        actual: nullableNumber,
        target: z.number().finite(),
        unit: z.enum(["count", "ratio", "position"]),
      })
    ),
  }),
});

export type SeoDashboardSnapshot = z.infer<typeof seoDashboardSnapshotSchema>;

export interface SeoHistoryPoint {
  capturedAt: string;
  generatedDate: string;
  phase: z.infer<typeof seoPhaseSchema>;
  decisionStatus: z.infer<typeof seoDecisionStatusSchema>;
  headTermPosition: number | null;
  treatmentImpressions: number;
  organicActivationRate: number | null;
  aiCitationRate: number | null;
  indexedRate: number | null;
  evaluationMode: "relative_lift" | "visibility_emergence";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`Invalid SEO history number: ${value}`);
  return parsed;
}

function calendarDate(value: unknown): string {
  const parsed = z.string().min(1).parse(value);
  const match = /^\d{4}-\d{2}-\d{2}/.exec(parsed);
  if (!match) throw new Error(`Invalid SEO history date: ${parsed}`);
  return match[0];
}

export function parseSeoHistoryRows(
  rows: readonly unknown[][]
): SeoHistoryPoint[] {
  const byDate = new Map<string, SeoHistoryPoint>();
  for (const row of rows) {
    const point: SeoHistoryPoint = {
      capturedAt: z.string().min(1).parse(row[0]),
      generatedDate: calendarDate(row[1]),
      phase: seoPhaseSchema.parse(row[2]),
      decisionStatus: seoDecisionStatusSchema.parse(row[3]),
      headTermPosition: numberOrNull(row[4]),
      treatmentImpressions: numberOrNull(row[5]) ?? 0,
      organicActivationRate: numberOrNull(row[6]),
      aiCitationRate: numberOrNull(row[7]),
      indexedRate: numberOrNull(row[8]),
      evaluationMode:
        row[9] === "visibility_emergence"
          ? "visibility_emergence"
          : "relative_lift",
    };
    byDate.set(point.generatedDate, point);
  }
  return [...byDate.values()].sort((left, right) =>
    left.generatedDate.localeCompare(right.generatedDate)
  );
}
