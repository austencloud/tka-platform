import { describe, expect, it } from "vitest";
import {
  summarizeTransitionGeometry,
  type TransitionGeometrySample,
  type TransitionGeometryTrace,
} from "../../../src/routes/test/sequence-viewer-transitions/transition-geometry-trace";

function sample(
  time: number,
  animationSize: number,
  animationOpacity: number
): TransitionGeometrySample {
  return {
    time,
    phase: "return-split",
    direction: "horizontal",
    focusedPane: null,
    selectedMode: "split",
    outerDirection: "horizontal",
    stageSize: 900,
    stageFlexGrow: 1,
    animationSize,
    animationFlexGrow: 1,
    animationHidden: false,
    animationReadable: true,
    mandalaBackingSize: 630,
    mandalaDisplaySize: 630,
    mandalaRasterScale: 1,
    cardSize: 450,
    cardFlexGrow: 1,
    cardHidden: false,
    cardReadable: true,
    cardPanelWidth: 450,
    cardPanelHeight: 600,
    cardPanelCenterX: 675,
    cardPanelCenterY: 300,
    cardRootWidth: 450,
    cardRootHeight: 600,
    cardRootCenterY: 300,
    cardContentWidth: 420,
    cardContentHeight: 350,
    cardContentCenterX: 675,
    cardContentCenterY: 300,
    cardTransformedCellCount: 0,
    cardColumns: 3,
    cardRows: 3,
    cardAutoLayoutLocked: false,
    cardAutoLayoutLockColumns: 0,
    cardAutoLayoutLockRows: 0,
    inspectorSize: 0,
    inspectorFlexGrow: 0,
    cardSettingsWidth: 0,
    cardSettingsHeight: 0,
    cardSettingsCenterY: 0,
    cardSettingsOpacity: 0,
    dissolveActive: false,
    animationOpacity,
    cardOpacity: 1,
  };
}

function trace(samples: TransitionGeometrySample[]): TransitionGeometryTrace {
  return { command: "card", duration: 280, samples, modeCommits: [] };
}

describe("Sequence Viewer geometry trace", () => {
  it("flags a returning animation surface that becomes visible as a sliver", () => {
    const summary = summarizeTransitionGeometry(
      trace([sample(0, 0, 0), sample(80, 147, 0.2), sample(280, 450, 1)])
    );

    expect(summary.animationEntryMinimum).toBe(147);
    expect(summary.tinyAnimationFrames).toBe(1);
  });

  it("accepts a staged reveal that waits for readable pane geometry", () => {
    const summary = summarizeTransitionGeometry(
      trace([sample(0, 0, 0), sample(80, 147, 0.1), sample(180, 300, 0.3)])
    );

    expect(summary.animationEntryMinimum).toBe(300);
    expect(summary.tinyAnimationFrames).toBe(0);
  });

  it("counts reduced-motion dissolve lifecycle frames", () => {
    const first = sample(0, 450, 1);
    const middle = { ...sample(100, 450, 1), dissolveActive: true };
    const last = sample(200, 450, 1);

    expect(
      summarizeTransitionGeometry(trace([first, middle, last])).dissolveFrames
    ).toBe(1);
  });

  it("flags a returning mandala raster that is enlarged from a collapsed backing store", () => {
    const collapsed = {
      ...sample(100, 450, 1),
      mandalaBackingSize: 48,
      mandalaDisplaySize: 630,
      mandalaRasterScale: 13.125,
    };

    const summary = summarizeTransitionGeometry(
      trace([sample(0, 0, 0), collapsed, sample(280, 450, 1)])
    );

    expect(summary.mandalaReturnRasterScaleMaximum).toBe(13.125);
    expect(summary.magnifiedMandalaReturnFrames).toBe(1);
  });

  it("flags Card height and aspect-ratio collapse even when opacity hides it", () => {
    const start = {
      ...sample(0, 450, 1),
      phase: "focus-card" as const,
      selectedMode: "split" as const,
    };
    const squashed = {
      ...sample(100, 450, 1),
      phase: "focus-card" as const,
      selectedMode: "card" as const,
      cardContentWidth: 420,
      cardContentHeight: 90,
      cardOpacity: 0,
      dissolveActive: false,
    };
    const end = {
      ...sample(200, 450, 1),
      phase: "focus-card" as const,
      selectedMode: "card" as const,
    };

    const summary = summarizeTransitionGeometry(trace([start, squashed, end]));

    expect(summary.squashedCardFrames).toBe(1);
    expect(summary.dissolveCoveredCardFrames).toBe(0);
    expect(summary.cardBoxMinimum).toEqual({ width: 420, height: 90 });
    expect(summary.cardAspectMaximum).toBeCloseTo(420 / 90);
    expect(summary.modePath).toEqual(["split", "card"]);
    expect(summary.panelDirectionPath).toEqual(["horizontal"]);
    expect(summary.outerDirectionPath).toEqual(["horizontal"]);
    expect(summary.cardLayoutPath).toEqual(["3×3"]);
    expect(summary.cardLayoutLockPath).toEqual(["free"]);
  });

  it("separates Card reflow hidden behind the reduced-motion dissolve", () => {
    const start = {
      ...sample(0, 450, 1),
      phase: "focus-card" as const,
    };
    const covered = {
      ...start,
      time: 100,
      cardContentWidth: 420,
      cardContentHeight: 90,
      dissolveActive: true,
    };

    const summary = summarizeTransitionGeometry(trace([start, covered]));

    expect(summary.squashedCardFrames).toBe(0);
    expect(summary.dissolveCoveredCardFrames).toBe(1);
    expect(summary.cardAspectMaximum).toBeCloseTo(420 / 350);
  });

  it("flags cell FLIP transforms that can escape a moving Card surface", () => {
    const transformed = {
      ...sample(100, 450, 1),
      cardTransformedCellCount: 4,
    };

    const summary = summarizeTransitionGeometry(
      trace([sample(0, 450, 1), transformed, sample(200, 450, 1)])
    );

    expect(summary.transformedCardCellFrames).toBe(1);
    expect(summary.maximumTransformedCardCells).toBe(4);
  });

  it("ignores the covered pre-click Card sample in an interruption", () => {
    const covered = {
      ...sample(0, 450, 1),
      phase: "interrupt-card" as const,
      cardContentWidth: 173,
      cardContentHeight: 250,
      cardOpacity: 0,
    };
    const visible = {
      ...covered,
      time: 16,
      cardContentWidth: 300,
      cardContentHeight: 434,
      cardOpacity: 1,
    };

    const summary = summarizeTransitionGeometry({
      command: "interrupt",
      duration: 280,
      samples: [covered, visible],
      modeCommits: [],
    });

    expect(summary.squashedCardFrames).toBe(0);
    expect(summary.cardBoxMinimum).toEqual({ width: 300, height: 434 });
  });

  it("measures reverse-leg size undershoot and travel backtrack", () => {
    const start = {
      ...sample(0, 450, 1),
      cardPanelWidth: 700,
      cardRootWidth: 700,
      cardContentWidth: 500,
      cardContentHeight: 700,
      cardContentCenterX: 500,
    };
    const dip = {
      ...start,
      time: 140,
      cardPanelWidth: 580,
      cardRootWidth: 580,
      cardContentWidth: 420,
      cardContentHeight: 590,
      cardContentCenterX: 480,
    };
    const end = {
      ...start,
      time: 280,
      cardPanelWidth: 660,
      cardRootWidth: 660,
      cardContentWidth: 480,
      cardContentHeight: 680,
      cardContentCenterX: 760,
    };

    const summary = summarizeTransitionGeometry(trace([start, dip, end]));

    expect(summary.cardReturnPanelWidth?.undershoot).toBe(80);
    expect(summary.cardReturnPanelHeight?.undershoot).toBe(0);
    expect(summary.cardReturnRootWidth?.undershoot).toBe(80);
    expect(summary.cardReturnRootHeight?.undershoot).toBe(0);
    expect(summary.cardReturnVisualWidth?.undershoot).toBe(60);
    expect(summary.cardReturnVisualHeight?.undershoot).toBe(90);
    expect(summary.cardReturnTravel?.backtrack).toBe(20);
    expect(summary.cardReturnTravel?.overshoot).toBe(0);
  });

  it("measures visible Card settings reflow independently of dock motion", () => {
    const narrow = {
      ...sample(0, 450, 1),
      phase: "focus-card" as const,
      cardSettingsWidth: 180,
      cardSettingsHeight: 700,
      cardSettingsCenterY: 470,
      cardSettingsOpacity: 0.2,
    };
    const settled = {
      ...narrow,
      time: 280,
      cardSettingsWidth: 560,
      cardSettingsHeight: 520,
      cardSettingsCenterY: 390,
      cardSettingsOpacity: 1,
    };

    const summary = summarizeTransitionGeometry(trace([narrow, settled]));

    expect(summary.cardSettingsFocusWidth?.variation).toBe(380);
    expect(summary.cardSettingsFocusHeight?.variation).toBe(180);
    expect(summary.cardSettingsFocusCenterY?.variation).toBe(80);
    expect(summary.cardSettingsReturnWidth).toBeNull();
  });
});
