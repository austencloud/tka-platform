/**
 * Pure helpers that turn AnimationVisibilityStateManager and
 * ExportOptionsStateManager state into the one-line summaries shown beneath
 * each pill label. All four are pure: same input → same output, no
 * closures over reactive state, fully unit-testable.
 */

// ============================================================================
// Display
// ============================================================================

/**
 * Single record of every boolean visibility flag the Display pill exposes.
 * Grid is included as a regular field so the denominator is genuinely
 * arity-derived from this record - no hardcoded `+1`.
 */
export interface DisplayFlags {
  tkaGlyph: boolean;
  stepNumbers: boolean;
  beatPosition: boolean;
  props: boolean;
  wordHeader: boolean;
  progressBar: boolean;
  grid: boolean;
}

export type PathShape = "arc" | "linear";

/**
 * Returns "<n> / <total> visible · <pathShape>".
 *
 * Path shape is a binary choice between two valid options (arc vs linear),
 * not on/off, so it is surfaced explicitly rather than counted. The
 * denominator is derived from the input arity - adding a new field to
 * DisplayFlags automatically updates the "/ N" denominator.
 */
export function computeDisplaySummary(
  flags: DisplayFlags,
  pathShape: PathShape,
): string {
  const values = Object.values(flags);
  const on = values.filter(Boolean).length;
  const total = values.length;
  return `${on} / ${total} visible · ${pathShape}`;
}

// ============================================================================
// Effects
// ============================================================================

/**
 * Returns the active effect's display name, "Off" for "none"/missing, or
 * "Custom" if the id isn't registered in the label map (a drift guard -
 * prevents raw kebab-case from leaking to users when a new effect ships in
 * state before its label entry is added).
 *
 * Accepts the label table as a parameter rather than importing EFFECT_LABELS
 * directly so the function stays pure and testable without module-level
 * coupling.
 *
 * Silent-failure hardening: if `activeEffect` is not a non-empty string,
 * log a warning (surfaces upstream state corruption in dev console) and
 * return "Off" as the safe neutral. Previously an empty/undefined value
 * would silently flow through `labels[""]` → "Custom", hiding the
 * corruption behind a plausible-looking label.
 */
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

// ============================================================================
// Playback
// ============================================================================

export type PlaybackModeLike = "continuous" | "step";

/**
 * Silent-failure hardening: BPM must be finite and positive. Upstream
 * corruption (NaN, 0, negative) would otherwise render literally as
 * "NaN BPM" / "0 BPM" to the user, obscuring that the state store is
 * broken. The "- BPM" fallback is a visible "something is wrong" signal,
 * and the warn surfaces the root cause in dev tools.
 */
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

// ============================================================================
// Export
// ============================================================================

export interface ExportSummaryInput {
  resolution: number;
  fps: number;
  loopCount: number;
  renderMode: "2d" | "3d";
}

/** Canonical resolutions the export pipeline supports. Any other value is
 *  either a state bug or an untested configuration; we render a visible
 *  "-" fallback rather than a plausible-looking garbage label. */
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
