import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isViewer3DIntroReplayRequested,
  shouldShowViewer3DIntro,
  markViewer3DIntroSeenLocal,
} from "../../src/lib/shared/onboarding/state/viewer3d-intro-state";

describe("viewer3d intro state", () => {
  beforeEach(() => localStorage.clear());

  it("shows on a first-ever open", () => {
    expect(shouldShowViewer3DIntro()).toBe(true);
  });

  it("never shows again after being marked seen", () => {
    markViewer3DIntroSeenLocal();
    expect(shouldShowViewer3DIntro()).toBe(false);
  });
});

// Once a person finishes the intro it is gone, on this device and on their
// synced profile — which leaves the card unreviewable. `?intro=replay` is the
// way back in, and it renders with `force` so a replay never re-marks it seen.
describe("viewer3d intro replay parameter", () => {
  it("recognizes ?intro=replay", () => {
    expect(isViewer3DIntroReplayRequested("?intro=replay")).toBe(true);
    expect(isViewer3DIntroReplayRequested("?render=3d&intro=replay")).toBe(
      true
    );
  });

  it("ignores every other query", () => {
    expect(isViewer3DIntroReplayRequested("")).toBe(false);
    expect(isViewer3DIntroReplayRequested("?render=3d")).toBe(false);
    expect(isViewer3DIntroReplayRequested("?intro=1")).toBe(false);
  });
});

// The intro card floats over the 3D pane, whose box runs BEHIND the playback
// transport. Anchoring the card to that box's raw bottom edge laid it on top of
// the play/BPM controls, which is what shipped. The card must reserve the same
// transport band SceneControlRail established ("the transport owns the bottom
// edge of the viewer"), in every size tier it declares.
describe("3D intro card reserves the transport band", () => {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );

  it("declares no bottom anchor that sits over the transport", () => {
    const css = readFileSync(
      path.join(
        repoRoot,
        "src/lib/shared/3d/components/onboarding/Viewer3DIntro.svelte"
      ),
      "utf8"
    );
    const bottoms = [...css.matchAll(/^\s*bottom:\s*(.+);$/gm)].map((m) =>
      m[1].trim()
    );
    expect(bottoms.length).toBeGreaterThan(0);
    for (const value of bottoms) {
      expect(
        /max\(\s*5rem,\s*calc\(\s*5rem \+ env\(safe-area-inset-bottom\)\s*\)\s*\)/.test(
          value
        ),
        `.intro-card bottom "${value}" does not reserve the transport band`
      ).toBe(true);
    }
  });
});
