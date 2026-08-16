import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { viewerModeOptions } from "$lib/shared/sequence-viewer/services/viewer-modes";
import {
  loadSplitConfig,
  loadViewerMode,
} from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
import { resolveEditingPane } from "$lib/shared/sequence-viewer/services/viewer-orchestrator-model";

const VIEWER_MODE_KEY = "tka-viewer-mode";
const SPLIT_CONFIG_KEY = "tka-viewer-split-config";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("sequence viewer Video mode", () => {
  it("uses Videos, not Mandala, in the primary switcher", () => {
    const ids = viewerModeOptions(false, false).map((mode) => mode.id);

    expect(ids).toContain("videos");
    expect(ids).not.toContain("mandala");
  });

  it("migrates stored Mandala views to standard viewer layouts", () => {
    localStorage.setItem(VIEWER_MODE_KEY, "mandala");
    expect(loadViewerMode()).toBe("split");
    expect(localStorage.getItem(VIEWER_MODE_KEY)).toBe("split");

    localStorage.setItem(
      SPLIT_CONFIG_KEY,
      JSON.stringify({ leftPane: "animation", rightPane: "mandala" })
    );
    expect(loadSplitConfig()).toEqual({
      leftPane: "animation",
      rightPane: "card",
    });
  });

  it("keeps Video browsing distinct from the upload inspector", () => {
    expect(resolveEditingPane("videos", null, false)).toBeNull();
    expect(resolveEditingPane("videos", null, true)).toBe("video-upload");
  });
});
