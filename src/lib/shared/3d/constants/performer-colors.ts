export const PERFORMER_COLORS = [
  "#3b82f6", "#ef4444", "#8b5cf6", "#f97316",
  "#10b981", "#ec4899", "#06b6d4", "#eab308",
] as const;

export function getPerformerColor(index: number): string {
  return PERFORMER_COLORS[index % PERFORMER_COLORS.length] ?? "#6b7280";
}
