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
vi.mock(
  "../../../animation-engine/state/animation-visibility-state.svelte",
  () => ({
    getAnimationVisibilityManager: () => ({
      isTransforming: () => false,
      registerObserver: () => {},
      unregisterObserver: () => {},
    }),
  })
);

import PropSvg from "./PropSvg.svelte";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "../../shared/domain/enums/pictograph-enums";
import { PropType } from "../domain/enums/prop-type";
import { EDITOR_TORCH_PALETTE } from "../domain/prop-render-context";

// Minimal, static motion — turns:0 + NO_ROTATION keeps the rotation animator inert
// so the test isolates the SVG-swap fade behaviour.
const motion = (
  color: MotionColor = MotionColor.BLUE,
  propType: PropType = PropType.TRIAD
) =>
  ({
    color,
    propType,
    startOrientation: Orientation.IN,
    turns: 0,
    rotationDirection: RotationDirection.NO_ROTATION,
  }) as never;

const motionData = motion();

const propPosition = { x: 0, y: 0, rotation: 0 } as never;

// Each call returns a NEW object, mirroring how the parent hands down a freshly
// prepared propAssets on every (re)generation — same content, new identity.
const assets = (imageSrc: string, propType?: PropType) =>
  ({
    imageSrc,
    viewBox: "0 0 300 15.5",
    center: { x: 0, y: 0 },
    propType,
  }) as never;

const SVG_A = "<circle r='10' data-variant='a' />";
const SVG_B = "<circle r='10' data-variant='b' />";
const TORCH_ARTWORK = `
  <path data-torch-shaft="true" style="fill:#231F20;" data-part="shaft" />
  <rect data-torch-metal="true" style="fill:url(#metal);" data-part="metal" />
  <path data-torch-wick="true" style="fill:#F6E5B6;" data-part="wick" />
`;

const propGroup = () => document.querySelector(".prop-svg");
const propTransform = () => propGroup()?.getAttribute("style") ?? "";
const partStyle = (part: string) =>
  document.querySelector(`[data-part="${part}"]`)?.getAttribute("style");

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

describe("PropSvg editor contrast", () => {
  it("does not alter torch rendering unless an editor opts in", () => {
    render(PropSvg, {
      motionData: motion(MotionColor.BLUE, PropType.TORCH),
      propAssets: assets(TORCH_ARTWORK, PropType.TORCH),
      propPosition,
    });

    expect(
      document.querySelector("[data-editor-prop-contrast]")
    ).not.toBeInTheDocument();
    expect(partStyle("shaft")).toContain("fill:#231F20");
    expect(partStyle("metal")).toContain("fill:url(#metal)");
    expect(
      document.querySelector("[data-torch-flame]")
    ).not.toBeInTheDocument();
  });

  it.each([
    [MotionColor.BLUE, PropType.TORCH],
    [MotionColor.RED, PropType.TORCH],
    [MotionColor.BLUE, PropType.BIGTORCH],
    [MotionColor.RED, PropType.BIGTORCH],
  ])("recolors %s %s assets on dark editor grids", (color, propType) => {
    render(PropSvg, {
      motionData: motion(color, propType),
      propAssets: assets(TORCH_ARTWORK, propType),
      propPosition,
      propRenderContext: "editor",
      darkMode: true,
    });

    const contrastGroup = document.querySelector("[data-editor-prop-contrast]");
    expect(contrastGroup).toBeInTheDocument();
    expect(contrastGroup).toHaveAttribute("data-editor-torch-palette", "dark");
    expect(partStyle("shaft")).toContain(
      `fill:${EDITOR_TORCH_PALETTE.dark.shaft}`
    );
    expect(partStyle("metal")).toContain(
      `fill:${EDITOR_TORCH_PALETTE.dark.metal}`
    );
    expect(partStyle("wick")).toContain(
      `fill:${EDITOR_TORCH_PALETTE.dark.wick}`
    );
    expect(document.querySelector("[data-torch-flame]")).toHaveAttribute(
      "data-torch-flame-size",
      propType === PropType.BIGTORCH ? "big" : "standard"
    );
    expect(
      document.querySelector('[data-torch-flame-part="body"]')
    ).toHaveAttribute("fill", EDITOR_TORCH_PALETTE.dark.flame);
  });

  it("uses the prepared asset type after a render-time prop override", () => {
    render(PropSvg, {
      motionData: motion(MotionColor.BLUE, PropType.STAFF),
      propAssets: assets(TORCH_ARTWORK, PropType.TORCH),
      propPosition,
      propRenderContext: "editor",
    });

    expect(
      document.querySelector("[data-editor-prop-contrast]")
    ).toBeInTheDocument();
  });

  it("leaves non-torch props unchanged in editor grids", () => {
    render(PropSvg, {
      motionData: motion(MotionColor.BLUE, PropType.STAFF),
      propAssets: assets(TORCH_ARTWORK, PropType.STAFF),
      propPosition,
      propRenderContext: "editor",
    });

    expect(
      document.querySelector("[data-editor-prop-contrast]")
    ).not.toBeInTheDocument();
    expect(
      document.querySelector("[data-torch-flame]")
    ).not.toBeInTheDocument();
  });

  it.each([
    [true, "dark"],
    [false, "light"],
  ] as const)(
    "uses the %s palette for the actual editor surface",
    (darkMode, paletteName) => {
      const palette = EDITOR_TORCH_PALETTE[paletteName];

      render(PropSvg, {
        motionData: motion(MotionColor.BLUE, PropType.TORCH),
        propAssets: assets(TORCH_ARTWORK, PropType.TORCH),
        propPosition,
        propRenderContext: "editor",
        darkMode,
      });

      expect(
        document.querySelector("[data-editor-prop-contrast]")
      ).toHaveAttribute("data-editor-torch-palette", paletteName);
      expect(partStyle("shaft")).toContain(`fill:${palette.shaft}`);
      expect(partStyle("metal")).toContain(`fill:${palette.metal}`);
      expect(partStyle("wick")).toContain(`fill:${palette.wick}`);
    }
  );

  it("keeps the original artwork for non-torch editor props", () => {
    render(PropSvg, {
      motionData: motion(MotionColor.BLUE, PropType.STAFF),
      propAssets: assets(TORCH_ARTWORK, PropType.STAFF),
      propPosition,
      propRenderContext: "editor",
    });

    expect(partStyle("shaft")).toContain("fill:#231F20");
    expect(partStyle("metal")).toContain("fill:url(#metal)");
  });
});

describe("PropSvg orientation transitions", () => {
  async function rerenderOrientation(
    fromOrientation: Orientation,
    fromRotation: number,
    toOrientation: Orientation,
    toRotation: number
  ) {
    const screen = render(PropSvg, {
      motionData: {
        ...(motionData as Record<string, unknown>),
        startOrientation: fromOrientation,
      } as never,
      propAssets: assets(SVG_A),
      propPosition: {
        ...(propPosition as Record<string, unknown>),
        rotation: fromRotation,
      } as never,
    });

    await screen.rerender({
      motionData: {
        ...(motionData as Record<string, unknown>),
        startOrientation: toOrientation,
      } as never,
      propAssets: assets(SVG_A),
      propPosition: {
        ...(propPosition as Record<string, unknown>),
        rotation: toRotation,
      } as never,
    });
    flushSync();
  }

  it("animates a left-arrow center change counterclockwise", async () => {
    await rerenderOrientation(
      Orientation.CENTER_N,
      270,
      Orientation.CENTER_NW,
      225
    );

    expect(propTransform()).toContain("rotate(225deg)");
    expect(propTransform()).not.toContain("rotate(585deg)");
  });

  it("animates a right-arrow center change clockwise", async () => {
    await rerenderOrientation(
      Orientation.CENTER_N,
      270,
      Orientation.CENTER_NE,
      315
    );

    expect(propTransform()).toContain("rotate(315deg)");
  });

  it("uses the selected direction for interradial changes", async () => {
    await rerenderOrientation(Orientation.IN, 90, Orientation.CLOCK_IN, 45);

    expect(propTransform()).toContain("rotate(45deg)");
    expect(propTransform()).not.toContain("rotate(405deg)");
  });
});
