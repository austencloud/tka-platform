export function computePropsSummary(propLabel: string): string {
  return propLabel || "Staff";
}

export interface DisplayFlags {
  tkaGlyph: boolean;
  stepNumbers: boolean;
  beatPosition: boolean;
  props: boolean;
  wordHeader: boolean;
  progressBar: boolean;
  grid: boolean;
}

export type PathShape = "arc" | "linear" | "concave";

export function computeDisplaySummary(
  flags: DisplayFlags,
  pathShape: PathShape,
): string {
  const values = Object.values(flags);
  const on = values.filter(Boolean).length;
  const total = values.length;
  return `${on} / ${total} visible · ${pathShape}`;
}

export function computeEffectsSummary(
  activeEffect: string,
  labels: Record<string, string>,
): string {
  if (typeof activeEffect !== "string" || activeEffect === "") {
    console.warn("[pill-summaries] invalid activeEffect:", activeEffect);
    return "Off";
  }
  if (activeEffect === "none") return "Off";
  return labels[activeEffect] ?? "Custom";
}

export type PlaybackModeLike = "continuous" | "step";

export function computePlaybackSummary(
  bpm: number,
  mode: PlaybackModeLike,
): string {
  const modeLabel = mode === "step" ? "Step" : "Cont.";
  if (!Number.isFinite(bpm) || bpm <= 0) {
    console.warn("[pill-summaries] invalid bpm:", bpm);
    return `- BPM • ${modeLabel}`;
  }
  return `${bpm} BPM • ${modeLabel}`;
}

export interface ExportSummaryInput {
  resolution: number;
  fps: number;
  loopCount: number;
  renderMode: "2d" | "3d";
}

const CANONICAL_RESOLUTIONS = new Set<number>([720, 1080, 2160, 4320]);

export function computeExportSummary(input: ExportSummaryInput): string {
  const { resolution: r, fps, loopCount, renderMode } = input;
  if (!CANONICAL_RESOLUTIONS.has(r) || !Number.isFinite(fps) || fps <= 0) {
    console.warn("[pill-summaries] invalid export input:", { resolution: r, fps });
    return "- • - fps";
  }
  const resLabel = renderMode === "3d"
    ? `${r}×${r}`
    : r >= 4320 ? "8K" : r >= 2160 ? "4K" : `${r}p`;
  const loopLabel = Number.isFinite(loopCount) && loopCount > 1
    ? ` • ${loopCount}×`
    : "";
  return `${resLabel} • ${fps} fps${loopLabel}`;
}
