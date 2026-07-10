// Pure serialize/restore for the guide Codex page's durable view prefs.
// The page itself (GuideCodexPage.svelte) is the printable sheet — there is no
// letter/grid-mode selection anymore (that lived in the retired Explorer-style
// layout). What persists now is just the reader's two live controls: which
// prop family renders across the whole sheet, and which layers are visible.
// Kept separate from the $state factory (guide-codex-state.svelte.ts) so it's
// unit-testable without a Svelte runtime.

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export const GUIDE_CODEX_STORAGE_KEY = "guide-codex-view-prefs";
const GUIDE_CODEX_PREFS_VERSION = 2;

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
  propType: PropType;
  visibility: GuideCodexVisibility;
}

/** Matches the printed sheet's hardcoded defaults exactly (grid + TKA glyph
 *  visible; the elemental/TnD glyph, positions, reversals and non-radial
 *  markers hidden) — so switching into the reader shows the identical sheet
 *  before the user touches a single control. */
export function defaultGuideCodexVisibility(): GuideCodexVisibility {
  return {
    showGlyph: false,
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
    propType: PropType.STAFF,
    visibility: defaultGuideCodexVisibility(),
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
    propType,
    visibility: { ...d.visibility, ...(p.visibility ?? {}) },
  };
}
