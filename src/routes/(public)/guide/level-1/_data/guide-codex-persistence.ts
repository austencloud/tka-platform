// Pure serialize/restore for the guide Codex page's durable view prefs.
// Mirrors src/lib/features/learn/codex/state/codex-explorer-persistence.ts —
// same shape (letter, grid mode, visibility), plus the guide-only addition of
// a selected PropType (staff/club/buugeng/triad/fan/minihoop/hand). Kept
// separate from the $state factory so it's unit-testable without a Svelte
// runtime.

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export const GUIDE_CODEX_STORAGE_KEY = "guide-codex-view-prefs";
const GUIDE_CODEX_PREFS_VERSION = 1;

export type GuideCodexGridMode = "diamond" | "box";

/** Prop families that actually render in the codex — see prop-type.ts. */
export const GUIDE_CODEX_PROP_TYPES = [
  PropType.STAFF,
  PropType.CLUB,
  PropType.BUUGENG,
  PropType.TRIAD,
  PropType.FAN,
  PropType.MINIHOOP,
  PropType.HAND,
] as const;

export interface GuideCodexVisibility {
  showGlyph: boolean;
  showGrid: boolean;
  showTKA: boolean;
  showPositions: boolean;
  showReversals: boolean;
  showNonRadialPoints: boolean;
}

export interface GuideCodexPrefs {
  version: number;
  selectedLetter: string;
  gridMode: GuideCodexGridMode;
  visibility: GuideCodexVisibility;
  propType: PropType;
}

export function defaultGuideCodexVisibility(): GuideCodexVisibility {
  return {
    showGlyph: true,
    showGrid: true,
    showTKA: true,
    showPositions: false,
    showReversals: false,
    showNonRadialPoints: false,
  };
}

export function defaultGuideCodexPrefs(): GuideCodexPrefs {
  return {
    version: GUIDE_CODEX_PREFS_VERSION,
    selectedLetter: "A",
    gridMode: "diamond",
    visibility: defaultGuideCodexVisibility(),
    propType: PropType.STAFF,
  };
}

export function serializeGuideCodexPrefs(prefs: GuideCodexPrefs): string {
  return JSON.stringify({ ...prefs, version: GUIDE_CODEX_PREFS_VERSION });
}

export function restoreGuideCodexPrefs(raw: string | null): GuideCodexPrefs {
  if (!raw) return defaultGuideCodexPrefs();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultGuideCodexPrefs();
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== GUIDE_CODEX_PREFS_VERSION
  ) {
    return defaultGuideCodexPrefs();
  }
  const p = parsed as Partial<GuideCodexPrefs>;
  const d = defaultGuideCodexPrefs();
  const propType = (GUIDE_CODEX_PROP_TYPES as readonly PropType[]).includes(
    p.propType as PropType
  )
    ? (p.propType as PropType)
    : d.propType;
  return {
    version: GUIDE_CODEX_PREFS_VERSION,
    selectedLetter: typeof p.selectedLetter === "string" ? p.selectedLetter : d.selectedLetter,
    gridMode: p.gridMode === "box" ? "box" : "diamond",
    visibility: { ...d.visibility, ...(p.visibility ?? {}) },
    propType,
  };
}
