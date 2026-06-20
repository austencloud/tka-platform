import { describe, it, expect } from "vitest";
import {
  serializeCodexExplorerPrefs,
  restoreCodexExplorerPrefs,
  defaultCodexExplorerPrefs,
  type CodexExplorerPrefs,
} from "./codex-explorer-persistence";

describe("codex explorer persistence", () => {
  const sample: CodexExplorerPrefs = {
    version: 1,
    selectedLetter: "Σ-",
    gridMode: "box",
    isDarkMode: true,
    blueTurnsOverride: 1,
    redTurnsOverride: null,
    visibility: {
      showGrid: true,
      showTKA: false,
      showTnD: true,
      showElemental: true,
      showPositions: false,
      showReversals: false,
      showNonRadialPoints: false,
    },
  };

  it("round-trips a full prefs object", () => {
    const restored = restoreCodexExplorerPrefs(serializeCodexExplorerPrefs(sample));
    expect(restored).toEqual(sample);
  });

  it("returns defaults for null / empty input", () => {
    expect(restoreCodexExplorerPrefs(null)).toEqual(defaultCodexExplorerPrefs());
    expect(restoreCodexExplorerPrefs("")).toEqual(defaultCodexExplorerPrefs());
  });

  it("returns defaults for corrupt JSON", () => {
    expect(restoreCodexExplorerPrefs("{not json")).toEqual(defaultCodexExplorerPrefs());
  });

  it("returns defaults when the version mismatches", () => {
    const stale = JSON.stringify({ ...sample, version: 0 });
    expect(restoreCodexExplorerPrefs(stale)).toEqual(defaultCodexExplorerPrefs());
  });

  it("fills missing visibility keys from defaults", () => {
    const partial = JSON.stringify({ ...sample, visibility: { showGrid: false } });
    const restored = restoreCodexExplorerPrefs(partial);
    expect(restored.visibility.showGrid).toBe(false);
    expect(restored.visibility.showTKA).toBe(defaultCodexExplorerPrefs().visibility.showTKA);
  });
});
