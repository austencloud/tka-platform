import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  CODEX_EXPLORER_STORAGE_KEY,
  defaultCodexExplorerPrefs,
  restoreCodexExplorerPrefs,
  serializeCodexExplorerPrefs,
  type CodexExplorerGridMode,
  type CodexExplorerPrefs,
  type CodexExplorerVisibility,
} from "./codex-explorer-persistence";

function readStored(): CodexExplorerPrefs {
  if (typeof localStorage === "undefined") return defaultCodexExplorerPrefs();
  return restoreCodexExplorerPrefs(localStorage.getItem(CODEX_EXPLORER_STORAGE_KEY));
}

export function gridModeEnum(mode: CodexExplorerGridMode): GridMode {
  return mode === "box" ? GridMode.BOX : GridMode.DIAMOND;
}

export function createCodexExplorerState() {
  const initial = readStored();

  let selectedLetter = $state(initial.selectedLetter);
  let gridMode = $state<CodexExplorerGridMode>(initial.gridMode);
  let isDarkMode = $state(initial.isDarkMode);
  let blueTurnsOverride = $state<number | null>(initial.blueTurnsOverride);
  let redTurnsOverride = $state<number | null>(initial.redTurnsOverride);
  let visibility = $state<CodexExplorerVisibility>({ ...initial.visibility });
  // Session-only, never persisted.
  let searchTerm = $state("");

  // Debounced persistence of the durable subset.
  $effect(() => {
    const serialized = serializeCodexExplorerPrefs({
      version: 1,
      selectedLetter,
      gridMode,
      isDarkMode,
      blueTurnsOverride,
      redTurnsOverride,
      visibility: $state.snapshot(visibility),
    });
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(CODEX_EXPLORER_STORAGE_KEY, serialized);
      } catch {
        // noop — private mode / quota
      }
    }, 400);
    return () => clearTimeout(timer);
  });

  return {
    get selectedLetter() {
      return selectedLetter;
    },
    set selectedLetter(v: string) {
      selectedLetter = v;
    },
    get gridMode() {
      return gridMode;
    },
    set gridMode(v: CodexExplorerGridMode) {
      gridMode = v;
    },
    get gridModeEnum() {
      return gridModeEnum(gridMode);
    },
    get isDarkMode() {
      return isDarkMode;
    },
    set isDarkMode(v: boolean) {
      isDarkMode = v;
    },
    get blueTurnsOverride() {
      return blueTurnsOverride;
    },
    set blueTurnsOverride(v: number | null) {
      blueTurnsOverride = v;
    },
    get redTurnsOverride() {
      return redTurnsOverride;
    },
    set redTurnsOverride(v: number | null) {
      redTurnsOverride = v;
    },
    get visibility() {
      return visibility;
    },
    get searchTerm() {
      return searchTerm;
    },
    set searchTerm(v: string) {
      searchTerm = v;
    },
    toggleVisibility(key: keyof CodexExplorerVisibility) {
      visibility = { ...visibility, [key]: !visibility[key] };
    },
  };
}

export type CodexExplorerState = ReturnType<typeof createCodexExplorerState>;
