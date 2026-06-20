// Pure serialize/restore for the Codex Explorer's durable view prefs.
// Kept separate from the rune state factory so it is unit-testable without a
// Svelte runtime. The factory (codex-explorer-state.svelte.ts) owns the
// $effect that calls these and touches localStorage.

export const CODEX_EXPLORER_STORAGE_KEY = "codex-explorer-prefs";
const CODEX_EXPLORER_PREFS_VERSION = 1;

export type CodexExplorerGridMode = "diamond" | "box";

export interface CodexExplorerVisibility {
  showGrid: boolean;
  showTKA: boolean;
  showTnD: boolean;
  showElemental: boolean;
  showPositions: boolean;
  showReversals: boolean;
  showNonRadialPoints: boolean;
}

export interface CodexExplorerPrefs {
  version: number;
  selectedLetter: string;
  gridMode: CodexExplorerGridMode;
  isDarkMode: boolean;
  blueTurnsOverride: number | null;
  redTurnsOverride: number | null;
  visibility: CodexExplorerVisibility;
}

export function defaultCodexExplorerVisibility(): CodexExplorerVisibility {
  return {
    showGrid: true,
    showTKA: true,
    showTnD: false,
    showElemental: true,
    showPositions: false,
    showReversals: false,
    showNonRadialPoints: false,
  };
}

export function defaultCodexExplorerPrefs(): CodexExplorerPrefs {
  return {
    version: CODEX_EXPLORER_PREFS_VERSION,
    selectedLetter: "W",
    gridMode: "diamond",
    isDarkMode: false,
    blueTurnsOverride: null,
    redTurnsOverride: null,
    visibility: defaultCodexExplorerVisibility(),
  };
}

export function serializeCodexExplorerPrefs(prefs: CodexExplorerPrefs): string {
  return JSON.stringify({ ...prefs, version: CODEX_EXPLORER_PREFS_VERSION });
}

export function restoreCodexExplorerPrefs(raw: string | null): CodexExplorerPrefs {
  if (!raw) return defaultCodexExplorerPrefs();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultCodexExplorerPrefs();
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== CODEX_EXPLORER_PREFS_VERSION
  ) {
    return defaultCodexExplorerPrefs();
  }
  const p = parsed as Partial<CodexExplorerPrefs>;
  const d = defaultCodexExplorerPrefs();
  return {
    version: CODEX_EXPLORER_PREFS_VERSION,
    selectedLetter: typeof p.selectedLetter === "string" ? p.selectedLetter : d.selectedLetter,
    gridMode: p.gridMode === "box" ? "box" : "diamond",
    isDarkMode: typeof p.isDarkMode === "boolean" ? p.isDarkMode : d.isDarkMode,
    blueTurnsOverride:
      typeof p.blueTurnsOverride === "number" ? p.blueTurnsOverride : null,
    redTurnsOverride:
      typeof p.redTurnsOverride === "number" ? p.redTurnsOverride : null,
    visibility: { ...d.visibility, ...(p.visibility ?? {}) },
  };
}
