export type FeedbackType = "bug" | "feature" | "general";

export function isFeedbackType(value: unknown): value is FeedbackType {
  return value === "bug" || value === "feature" || value === "general";
}
