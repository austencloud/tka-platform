import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";

const integerFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatInteger(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "Not measured"
    : integerFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not measured";
  const percentage = value * 100;
  const digits = Number.isInteger(percentage) ? 0 : 1;
  return `${percentage.toFixed(digits)}%`;
}

export function formatPosition(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "Not ranked"
    : value.toFixed(1);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not registered";
  return dateFormatter.format(new Date(`${value}T12:00:00.000Z`));
}

export function formatLift(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Baseline";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}% vs control`;
}

export type SeoGrowthTone = "waiting" | "positive" | "negative" | "neutral";

export interface SeoGrowthStory {
  value: string;
  headline: string;
  explanation: string;
  nextStep: string;
  tone: SeoGrowthTone;
}

function formatGrowth(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

/**
 * Turns the experiment state into the one answer the dashboard should lead
 * with. Supporting metrics can explain the verdict after it is understood.
 */
export function getSeoGrowthStory(
  snapshot: SeoDashboardSnapshot
): SeoGrowthStory {
  if (snapshot.phase === "baseline") {
    return {
      value: "Too early to tell",
      headline: "The SEO changes are not marked live yet.",
      explanation:
        "Today's numbers are the starting point. Growth begins after the launch date is recorded and Google finds the updated pages.",
      nextStep: snapshot.experimentDates.deploymentDate
        ? "Let a measurement run confirm that Google found the pages."
        : "Record the SEO launch date.",
      tone: "waiting",
    };
  }

  if (snapshot.phase === "awaiting_indexing") {
    return {
      value: "Too early to tell",
      headline:
        "The changes are live. Google has not found all the sample pages yet.",
      explanation:
        "The next measurement run checks the sample pages. The before-and-after comparison starts when they can appear in Google search.",
      nextStep: "Let a measurement run check the updated pages.",
      tone: "waiting",
    };
  }

  const impressionLift = snapshot.search.controlAdjusted?.impressionLift;
  if (impressionLift === null || impressionLift === undefined) {
    return {
      value: "Measuring now",
      headline: "The before-and-after check is running.",
      explanation:
        "The updated pages are being compared with the starting point and with similar pages left unchanged.",
      nextStep: "Let the measurement window finish.",
      tone: "waiting",
    };
  }

  const tone: SeoGrowthTone =
    impressionLift > 0.005
      ? "positive"
      : impressionLift < -0.005
        ? "negative"
        : "neutral";
  const headline =
    snapshot.phase === "confirmed"
      ? tone === "positive"
        ? "The increase held up twice."
        : "The second check is complete."
      : tone === "positive"
        ? "The first comparison points upward."
        : tone === "negative"
          ? "The first comparison points downward."
          : "The first comparison shows no clear movement.";

  return {
    value: formatGrowth(impressionLift),
    headline,
    explanation:
      "This percentage removes movement also seen on similar pages that were left unchanged.",
    nextStep:
      snapshot.phase === "confirmed"
        ? "The full before-and-after test is complete."
        : snapshot.phase === "primary_complete"
          ? "Repeat the check with fresh dates before trusting the result."
          : "Let the measurement window finish.",
    tone,
  };
}

export interface SeoHistoryStory {
  headline: string;
  explanation: string;
  tone: SeoGrowthTone;
}

export type SeoOutcomeStatus = "pass" | "fail" | "waiting";

export function getSeoOutcomeStatus(
  criteria: readonly SeoDashboardSnapshot["decision"]["criteria"][number][],
  criterionIds: readonly string[]
): SeoOutcomeStatus {
  const checks = criteria.filter((criterion) =>
    criterionIds.includes(criterion.id)
  );
  if (checks.some((criterion) => criterion.status === "fail")) return "fail";
  if (
    checks.length === criterionIds.length &&
    checks.every((criterion) => criterion.status === "pass")
  ) {
    return "pass";
  }
  return "waiting";
}

export function getSeoHistoryStory(
  history: readonly {
    phase: SeoDashboardSnapshot["phase"];
    treatmentImpressions: number;
  }[]
): SeoHistoryStory {
  if (history.length === 0) {
    return {
      headline: "No readings yet",
      explanation: "The first measurement run will save a starting number.",
      tone: "waiting",
    };
  }

  const first = history[0];
  const latest = history[history.length - 1];
  if (!first || !latest) {
    return {
      headline: "No readings yet",
      explanation: "The first measurement run will save a starting number.",
      tone: "waiting",
    };
  }

  if (latest.phase === "baseline") {
    return {
      headline: "Still setting the starting point",
      explanation:
        history.length === 1
          ? `${formatInteger(latest.treatmentImpressions)} Google appearances recorded. This is not a growth result yet.`
          : `${history.length} starting-point readings are saved. They do not measure growth yet.`,
      tone: "waiting",
    };
  }

  if (history.length === 1) {
    return {
      headline: "One reading saved",
      explanation: `${formatInteger(latest.treatmentImpressions)} Google appearances. Another reading is needed to show movement.`,
      tone: "waiting",
    };
  }

  const difference = latest.treatmentImpressions - first.treatmentImpressions;
  if (difference === 0) {
    return {
      headline: "No movement yet",
      explanation: `Google appearances stayed at ${formatInteger(latest.treatmentImpressions)} from the first reading to the latest.`,
      tone: "neutral",
    };
  }

  const direction = difference > 0 ? "more" : "fewer";
  return {
    headline:
      difference > 0
        ? "Google appearances increased"
        : "Google appearances decreased",
    explanation: `${formatInteger(Math.abs(difference))} ${direction} appearances than the first reading.`,
    tone: difference > 0 ? "positive" : "negative",
  };
}

export function formatCriterion(
  criterion: SeoDashboardSnapshot["decision"]["criteria"][number]
): string {
  if (criterion.actual === null) return "Waiting";
  if (criterion.unit === "ratio") return formatPercent(criterion.actual);
  if (criterion.unit === "position") return criterion.actual.toFixed(1);
  return formatInteger(criterion.actual);
}
