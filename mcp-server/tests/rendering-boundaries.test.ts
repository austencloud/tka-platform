import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCanvas } from "canvas";
import { calculateArrowRotation } from "../src/core/arrow-placement.js";
import { convertToSequenceResult } from "../src/core/engine-generation-adapter.js";
import {
  resolveHeaderDisplay,
  resolveRenderedTurns,
} from "../src/core/sequence-renderer.js";
import { getStandaloneRenderer } from "../src/core/standalone-renderer.js";
import { renderWordHeader } from "../src/core/text-renderer.js";
import { loadTkaGlyphImages } from "../src/core/tka-glyph-image-loader.js";

describe("MCP rendering boundaries", () => {
  it("uses the normal static rotation map and leaves direction to mirroring", () => {
    const locations = ["n", "e", "s", "w", "ne", "se", "sw", "nw"];

    for (const location of locations) {
      assert.equal(
        calculateArrowRotation(
          "static",
          location,
          "cw",
          undefined,
          undefined,
          true
        ),
        calculateArrowRotation(
          "static",
          location,
          "ccw",
          undefined,
          undefined,
          true
        )
      );
      assert.equal(
        calculateArrowRotation(
          "static",
          location,
          "cw",
          undefined,
          undefined,
          false
        ),
        calculateArrowRotation(
          "static",
          location,
          "ccw",
          undefined,
          undefined,
          false
        )
      );
    }

    assert.equal(
      calculateArrowRotation("static", "w", "ccw", undefined, undefined, true),
      270
    );
    assert.equal(
      calculateArrowRotation("static", "w", "ccw", undefined, undefined, false),
      90
    );
  });

  it("uses canonical step turns instead of overwriting them at render time", () => {
    const step = {
      stepNumber: 5,
      blueMotion: { turns: 0 },
      redMotion: { turns: 1 },
    } as Parameters<typeof resolveRenderedTurns>[0];
    const unrelatedFallback = {
      blue: [0, 0, 0, 0, 1],
      red: [0, 0, 0, 0, 0],
    };

    assert.deepEqual(resolveRenderedTurns(step, unrelatedFallback), {
      blue: 0,
      red: 1,
    });
  });

  it("keeps the legacy allocation only when a step has no turn data", () => {
    const step = {
      stepNumber: 2,
      blueMotion: {},
      redMotion: {},
    } as Parameters<typeof resolveRenderedTurns>[0];
    const fallback = {
      blue: [0, 1],
      red: [1, 0],
    };

    assert.deepEqual(resolveRenderedTurns(step, fallback), {
      blue: 1,
      red: 0,
    });
  });

  it("labels a generated sequence with every rendered beat, including bridges", () => {
    const steps = [
      { stepNumber: 0, letter: "α" },
      { stepNumber: 1, letter: "Σ", isBridge: false },
      { stepNumber: 2, letter: "W", isBridge: true },
      { stepNumber: 3, letter: "Σ", isBridge: false },
    ] as Parameters<typeof resolveHeaderDisplay>[0];

    assert.deepEqual(resolveHeaderDisplay(steps, "ΣΣ"), {
      word: "ΣWΣ",
      letterStyles: [
        { letter: "Σ", isBridge: false, isDerived: false },
        { letter: "W", isBridge: true, isDerived: false },
        { letter: "Σ", isBridge: false, isDerived: false },
      ],
    });
  });

  it("keeps an explicit LOOP seed word compact", () => {
    const steps = [
      { stepNumber: 0, letter: "α" },
      { stepNumber: 1, letter: "Σ", isBridge: false },
      { stepNumber: 2, letter: "W", isBridge: true },
      { stepNumber: 3, letter: "Σ", isBridge: false },
      { stepNumber: 4, letter: "Σ", isBridge: false },
    ] as Parameters<typeof resolveHeaderDisplay>[0];

    assert.equal(resolveHeaderDisplay(steps, "ΣWΣΣ", "ΣΣ", [4]).word, "ΣΣ");
  });

  it("preserves explicit motion colors when converting engine output", () => {
    const motion = {
      motionType: "shift",
      rotationDirection: "cw",
      startLocation: "n",
      endLocation: "e",
      startOrientation: "in",
      endOrientation: "in",
    };
    const buildResult = {
      sequence: [
        {
          letter: "A",
          startPosition: "alpha1",
          endPosition: "alpha3",
          motions: {
            blue: { ...motion },
            red: { ...motion },
          },
          stepNumber: 0,
        },
      ],
      bridgeStepIndices: [],
    } as unknown as Parameters<typeof convertToSequenceResult>[0];

    const result = convertToSequenceResult(buildResult, {
      gridMode: "diamond",
      level: 2,
    });

    assert.equal(result.steps[0]?.blueMotion.color, "blue");
    assert.equal(result.steps[0]?.redMotion.color, "red");
  });

  it("scopes blue and red fan styles inside one pictograph", async () => {
    const renderer = getStandaloneRenderer();
    const svg = await renderer.renderToSvg(
      {
        letter: "A",
        startPosition: "alpha1",
        endPosition: "alpha3",
        gridMode: "diamond",
        blueMotion: {
          motionType: "pro",
          rotationDirection: "cw",
          startLocation: "n",
          endLocation: "e",
          startOrientation: "in",
          color: "blue",
          turns: 0,
        },
        redMotion: {
          motionType: "anti",
          rotationDirection: "ccw",
          startLocation: "s",
          endLocation: "w",
          startOrientation: "in",
          color: "red",
          turns: 0,
        },
      },
      {
        darkMode: true,
        showGrid: false,
        showTKA: false,
        bluePropType: "fan",
        redPropType: "fan",
      }
    );

    assert.ok(svg.includes(".st0-blue{fill:#3575E2;}"));
    assert.ok(svg.includes('class="st0-blue"'));
    assert.ok(svg.includes(".st0-red{fill:#ED1C24;}"));
    assert.ok(svg.includes('class="st0-red"'));
    assert.doesNotMatch(svg, /class="st0"/);
  });

  it("renders a nonzero static arrow while keeping zero-turn static motion arrowless", async () => {
    const renderer = getStandaloneRenderer();
    const input = {
      letter: "Σ",
      startPosition: "alpha3",
      endPosition: "gamma1",
      gridMode: "diamond",
      blueMotion: {
        motionType: "static",
        rotationDirection: "cw",
        startLocation: "w",
        endLocation: "w",
        startOrientation: "out",
        color: "blue",
        turns: 1,
      },
      redMotion: {
        motionType: "pro",
        rotationDirection: "ccw",
        startLocation: "e",
        endLocation: "n",
        startOrientation: "out",
        color: "red",
        turns: 0,
      },
    };
    const visibility = {
      darkMode: true,
      showGrid: false,
      showTKA: false,
      showBlueMotion: true,
      showRedMotion: false,
      bluePropType: "fan",
    };

    const oneTurnSvg = await renderer.renderToSvg(input, visibility);
    const zeroTurnSvg = await renderer.renderToSvg(
      {
        ...input,
        blueMotion: { ...input.blueMotion, turns: 0 },
      },
      visibility
    );

    assert.match(oneTurnSvg, /class="svg-arrow svg-arrow-blue"/);
    assert.doesNotMatch(zeroTurnSvg, /class="svg-arrow svg-arrow-blue"/);
  });

  it("loads canonical glyph assets, including Greek, bridge, and dash letters", async () => {
    const glyphs = await loadTkaGlyphImages("ΣWΘQVY-", true);

    assert.equal(glyphs?.size, 6);
    assert.ok((glyphs?.get("Σ")?.naturalHeight ?? 0) > 0);
    assert.ok((glyphs?.get("W")?.naturalWidth ?? 0) > 0);
    assert.ok((glyphs?.get("Θ")?.naturalHeight ?? 0) > 0);
    assert.ok((glyphs?.get("Q")?.naturalWidth ?? 0) > 0);
    assert.equal(glyphs?.get("Y-")?.isDash, true);
  });

  it("renders a canonical header with glyph images instead of word text", async () => {
    const canvas = createCanvas(900, 120);
    const context = canvas.getContext("2d");
    const drawnText: string[] = [];
    let imageCount = 0;
    const originalFillText = context.fillText.bind(context);
    const originalDrawImage = context.drawImage.bind(context);

    context.fillText = ((...args: Parameters<typeof originalFillText>) => {
      drawnText.push(args[0]);
      return originalFillText(...args);
    }) as typeof context.fillText;
    context.drawImage = ((...args: Parameters<typeof originalDrawImage>) => {
      imageCount++;
      return originalDrawImage(...args);
    }) as typeof context.drawImage;

    await renderWordHeader(context, "ΣWΣ", 900, 120, 2, false, true);

    assert.equal(imageCount, 3);
    assert.ok(!drawnText.includes("ΣWΣ"));
  });
});
