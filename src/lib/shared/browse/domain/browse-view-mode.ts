import type { HandSide } from "@tka/tka-types";

export interface BrowseViewMode {
  subject: "props" | "hands";
  granularity: "combined" | "solo";
  hand: HandSide;
}

export const DEFAULT_BROWSE_VIEW_MODE: BrowseViewMode = {
  subject: "props",
  granularity: "combined",
  hand: "left",
};

/** Accepts browse state saved before performer hands replaced palette names. */
export function normalizeBrowseViewMode(value: unknown): BrowseViewMode {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_BROWSE_VIEW_MODE };
  }
  const record = value as Record<string, unknown>;
  const subject = record.subject === "hands" ? "hands" : "props";
  const granularity = record.granularity === "solo" ? "solo" : "combined";
  const hand: HandSide =
    record.hand === "right" || record.color === "red" ? "right" : "left";
  return { subject, granularity, hand };
}

export function encodeViewMode(mode: BrowseViewMode): string | undefined {
  if (mode.subject === "props" && mode.granularity === "combined") return undefined;
  const s = mode.subject === "hands" ? "h" : "p";
  if (mode.granularity === "combined") return `${s}c`;
  // Keep the compact b/r URL format stable for existing shared links. The
  // adapter translates it at the boundary; application state stays left/right.
  return `${s}s${mode.hand === "left" ? "b" : "r"}`;
}

export function decodeViewMode(vm: string): BrowseViewMode | null {
  if (vm.length < 2) return null;
  const subject = vm[0] === "h" ? "hands" : vm[0] === "p" ? "props" : null;
  if (!subject) return null;
  if (vm[1] === "c") return { subject, granularity: "combined", hand: "left" };
  if (vm[1] === "s" && vm.length >= 3) {
    const hand: HandSide = vm[2] === "r" ? "right" : "left";
    return { subject, granularity: "solo", hand };
  }
  return null;
}
