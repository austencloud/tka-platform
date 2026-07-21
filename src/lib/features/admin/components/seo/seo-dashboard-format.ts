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

export function formatCriterion(
  criterion: SeoDashboardSnapshot["decision"]["criteria"][number]
): string {
  if (criterion.actual === null) return "Waiting";
  if (criterion.unit === "ratio") return formatPercent(criterion.actual);
  if (criterion.unit === "position") return criterion.actual.toFixed(1);
  return formatInteger(criterion.actual);
}
