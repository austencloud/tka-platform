import { beforeEach, describe, expect, it } from "vitest";
import {
  shouldShowViewer3DIntro,
  markViewer3DIntroSeenLocal,
} from "../../src/lib/shared/onboarding/state/viewer3d-intro-state.svelte";

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
