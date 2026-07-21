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
  return value === null || value === undefined
    ? "Not measured"
    : `${(value * 100).toFixed(1)}%`;
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
      value: "Not measured yet",
      headline: "This is the before picture.",
      explanation:
        "Growth can be calculated after the SEO changes go live and Google confirms the pages are indexed.",
      nextStep: snapshot.experimentDates.deploymentDate
        ? "Next: a measurement run needs to confirm Google indexing."
        : "Next: register the date when the SEO changes go live.",
      tone: "waiting",
    };
  }

  if (snapshot.phase === "awaiting_indexing") {
    return {
      value: "Waiting on Google",
      headline: "The SEO changes are live.",
      explanation:
        "Each measurement run checks the sample pages. The first growth check starts when indexing is confirmed.",
      nextStep: "Next: confirm that Google has indexed the sample pages.",
      tone: "waiting",
    };
  }

  const impressionLift = snapshot.search.controlAdjusted?.impressionLift;
  if (impressionLift === null || impressionLift === undefined) {
    return {
      value: "Collecting",
      headline: "The first growth check is running.",
      explanation:
        "Google appearances are being compared with similar pages that did not receive the SEO update.",
      nextStep: "Next: let the full measurement window finish.",
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
        ? "Growth passed both checks."
        : "The proof check is complete."
      : tone === "positive"
        ? "Google visibility is growing."
        : tone === "negative"
          ? "Google visibility is down."
          : "Google visibility is holding steady.";

  return {
    value: formatGrowth(impressionLift),
    headline,
    explanation:
      "This is the change in Google appearances after removing the movement seen on similar comparison pages.",
    nextStep:
      snapshot.phase === "confirmed"
        ? "Result: the full measurement cycle is complete."
        : snapshot.phase === "primary_complete"
          ? "Next: repeat the check with a fresh window before calling the result proven."
          : "Next: let the full measurement window finish.",
    tone,
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
