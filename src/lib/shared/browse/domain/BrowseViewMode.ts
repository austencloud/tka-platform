export interface BrowseViewMode {
  subject: "props" | "hands";
  granularity: "combined" | "solo";
  color: "blue" | "red";
}

export const DEFAULT_BROWSE_VIEW_MODE: BrowseViewMode = {
  subject: "props",
  granularity: "combined",
  color: "blue",
};

export function encodeViewMode(mode: BrowseViewMode): string | undefined {
  if (mode.subject === "props" && mode.granularity === "combined") return undefined;
  const s = mode.subject === "hands" ? "h" : "p";
  if (mode.granularity === "combined") return `${s}c`;
  return `${s}s${mode.color === "blue" ? "b" : "r"}`;
}

export function decodeViewMode(vm: string): BrowseViewMode | null {
  if (vm.length < 2) return null;
  const subject = vm[0] === "h" ? "hands" : vm[0] === "p" ? "props" : null;
  if (!subject) return null;
  if (vm[1] === "c") return { subject, granularity: "combined", color: "blue" };
  if (vm[1] === "s" && vm.length >= 3) {
    const color = vm[2] === "r" ? "red" : "blue";
    return { subject, granularity: "solo", color } as BrowseViewMode;
  }
  return null;
}
