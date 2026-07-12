import { render } from "vitest-browser-svelte";
import { describe, it, expect, vi } from "vitest";
import { flushSync } from "svelte";

// PropSvg's fade-on-swap logic reads only `propAssets.imageSrc`. It does not
// touch app settings or the visibility manager (those feed mirroring/transform
// only). Stub both so the test doesn't drag in the entire app dependency graph
// (firebase, posthog, capacitor, dexie) — which would make this test slow and
// flaky under Vite's cold dep-optimize. Isolating the unit keeps it lean.
vi.mock("../../../application/state/app-state.svelte", () => ({
  getSettings: () => ({}),
}));
vi.mock("../../../animation-engine/state/animation-visibility-state.svelte", () => ({
  getAnimationVisibilityManager: () => ({
    isTransforming: () => false,
    registerObserver: () => {},
    unregisterObserver: () => {},
  }),
}));

import PropSvg from "./PropSvg.svelte";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "../../shared/domain/enums/pictograph-enums";
import { PropType } from "../domain/enums/prop-type";

// Minimal, static motion — turns:0 + NO_ROTATION keeps the rotation animator inert
// so the test isolates the SVG-swap fade behaviour.
const motionData = {
  color: MotionColor.BLUE,
  propType: PropType.TRIAD,
  startOrientation: Orientation.IN,
  turns: 0,
  rotationDirection: RotationDirection.NO_ROTATION,
} as never;

const propPosition = { x: 0, y: 0, rotation: 0 } as never;

// Each call returns a NEW object, mirroring how the parent hands down a freshly
// prepared propAssets on every (re)generation — same content, new identity.
const assets = (imageSrc: string) =>
  ({ imageSrc, center: { x: 0, y: 0 } }) as never;

const SVG_A = "<circle r='10' data-variant='a' />";
const SVG_B = "<circle r='10' data-variant='b' />";

const propGroup = () => document.querySelector(".prop-svg");

describe("PropSvg fade-on-swap regression", () => {
  // Regression: an SVG swap starts a brief fade (opacity 0.15). If the parent
  // then re-hands a NEW propAssets object with a BYTE-IDENTICAL imageSrc while
  // the fade is still in flight (routine during generation), the tracking effect
  // re-runs. It must NOT strand `prop-fading` on the element — the fade has to
  // clear once the timeout elapses. Previously the effect teardown cancelled the
  // reset timer on that unrelated re-run and left the prop at opacity 0.15.
  it("clears the fade even when the effect re-runs with an identical imageSrc mid-fade", async () => {
    const screen = render(PropSvg, {
      motionData,
      propAssets: assets(SVG_A),
      propPosition,
      cellIndex: null,
    });

    // Real content swap A -> B triggers the brief fade.
    await screen.rerender({
      motionData,
      propAssets: assets(SVG_B),
      propPosition,
      cellIndex: null,
    });
    flushSync();
    expect(propGroup()?.classList.contains("prop-fading")).toBe(true);

    // Parent re-hands a new propAssets object with the SAME imageSrc mid-fade.
    // Re-runs the effect without a real change — the strand-inducing case.
    await screen.rerender({
      motionData,
      propAssets: assets(SVG_B),
      propPosition,
      cellIndex: null,
    });
    flushSync();

    // After the 150ms fade window the class must be gone (opacity restored).
    await new Promise((resolve) => setTimeout(resolve, 220));
    flushSync();
    expect(propGroup()?.classList.contains("prop-fading")).toBe(false);
  });
});
