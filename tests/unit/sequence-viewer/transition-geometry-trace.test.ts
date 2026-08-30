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
    inspectorIdentity: 0,
    desktopInspectorExpected: true,
    cardSettingsWidth: 0,
    cardSettingsHeight: 0,
    cardSettingsCenterY: 0,
    cardSettingsOpacity: 0,
    dissolveActive: false,
    animationOpacity,
    cardOpacity: 1,
    motion2DOpacity: 1,
    motion3DOpacity: 0,
    motion2DPresented: true,
    motion3DPresented: false,
    motion3DReady: false,
    motion3DPreparing: false,
    sceneCurtainVisible: false,
    tunnelOpacity: 0,
    tunnelPresented: false,
    tunnelCanvasReady: true,
    animatorIdentity: 1,
    animatorCanvasCount: 1,
    activeArtSettingsCount: 0,
    tunnelBackingWidth: 0,
    tunnelBackingHeight: 0,
    tunnelDisplayWidth: 0,
    tunnelDisplayHeight: 0,
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

  it("flags a blank frame or an unready 3D surface in the motion handoff", () => {
    const blank = {
      ...sample(80, 450, 1),
      phase: "prepare-3d" as const,
      selectedMode: "animation-3d" as const,
      motion2DOpacity: 0,
      motion3DOpacity: 0,
      motion2DPresented: false,
      motion3DPresented: true,
      motion3DReady: false,
    };
    const ready = {
      ...blank,
      time: 160,
      phase: "show-3d" as const,
      motion3DOpacity: 1,
      motion3DReady: true,
    };

    const summary = summarizeTransitionGeometry({
      command: "3d-first",
      duration: 200,
      samples: [sample(0, 450, 1), blank, ready],
      modeCommits: [],
    });

    expect(summary.motionBlankFrames).toBe(1);
    expect(summary.motionUnready3DFrames).toBe(1);
    expect(summary.motionHandoffLatency).toBe(80);
  });

  it("accepts a first 3D reveal that stays behind 2D until ready", () => {
    const preparing = {
      ...sample(40, 450, 1),
      phase: "prepare-3d" as const,
      selectedMode: "animation-3d" as const,
      motion3DPreparing: true,
    };
    const reveal = {
      ...preparing,
      time: 180,
      phase: "show-3d" as const,
      motion2DOpacity: 0.7,
      motion3DOpacity: 0.3,
      motion2DPresented: false,
      motion3DPresented: true,
      motion3DReady: true,
      motion3DPreparing: false,
    };
    const settled = {
      ...reveal,
      time: 260,
      motion2DOpacity: 0,
      motion3DOpacity: 1,
    };

    const summary = summarizeTransitionGeometry({
      command: "3d-first",
      duration: 260,
      samples: [sample(0, 450, 1), preparing, reveal, settled],
      modeCommits: [],
    });

    expect(summary.motionBlankFrames).toBe(0);
    expect(summary.motionUnready3DFrames).toBe(0);
    expect(summary.motionCurtainFrames).toBe(0);
    expect(summary.motionCrossfadeFrames).toBe(1);
    expect(summary.motionPreparationFrames).toBe(1);
    expect(summary.motionSurfacePath).toEqual(["2D", "3D"]);
    expect(summary.motionHandoffLatency).toBe(140);
  });

  it("flags a 2D backing-store rebuild after the returning surface is opaque", () => {
    const returning = {
      ...sample(200, 940, 1),
      phase: "return-2d" as const,
      selectedMode: "animation" as const,
      motion2DPresented: true,
      motion2DOpacity: 1,
      mandalaBackingSize: 963,
    };
    const lateResize = {
      ...returning,
      time: 280,
      mandalaBackingSize: 940,
    };

    const summary = summarizeTransitionGeometry({
      command: "3d-repeat",
      duration: 280,
      samples: [returning, lateResize],
      modeCommits: [],
    });

    expect(summary.motionLate2DBackingChanges).toBe(1);
  });

  it("flags a Tunnel that becomes visible before its canvas is ready", () => {
    const unready = {
      ...sample(80, 900, 1),
      phase: "prepare-tunnel" as const,
      selectedMode: "tunnel" as const,
      tunnelOpacity: 0.25,
      tunnelPresented: true,
      tunnelCanvasReady: false,
    };
    const ready = {
      ...unready,
      time: 180,
      phase: "show-tunnel" as const,
      tunnelOpacity: 1,
      tunnelCanvasReady: true,
      tunnelBackingWidth: 900,
      tunnelBackingHeight: 900,
      tunnelDisplayWidth: 900,
      tunnelDisplayHeight: 900,
    };
    const hiddenAfterReturn = {
      ...ready,
      time: 280,
      selectedMode: "animation" as const,
      tunnelOpacity: 0,
      tunnelPresented: false,
      tunnelDisplayWidth: 200,
      tunnelDisplayHeight: 200,
    };

    const summary = summarizeTransitionGeometry({
      command: "tunnel-first",
      duration: 280,
      samples: [sample(0, 900, 1), unready, ready, hiddenAfterReturn],
      modeCommits: [],
    });

    expect(summary.tunnelUnreadyFrames).toBe(1);
    expect(summary.tunnelCrossfadeFrames).toBe(1);
    expect(summary.tunnelDoubleFadeFrames).toBe(0);
    expect(summary.tunnelBlankFrames).toBe(0);
    expect(summary.tunnelSurfacePath).toEqual([
      "2D base",
      "2D base + Tunnel layers",
      "Tunnel",
      "2D base",
    ]);
    expect(summary.tunnelHandoffLatency).toBe(100);
    expect(summary.tunnelDisplaySize).toEqual({
      start: 900,
      end: 900,
      minimum: 900,
      maximum: 900,
      variation: 0,
    });
  });

  it("flags a Tunnel backing-store change after the overlay is opaque", () => {
    const settled = {
      ...sample(180, 900, 1),
      phase: "show-tunnel" as const,
      selectedMode: "tunnel" as const,
      tunnelOpacity: 1,
      tunnelPresented: true,
      tunnelCanvasReady: true,
      tunnelBackingWidth: 940,
      tunnelBackingHeight: 940,
      tunnelDisplayWidth: 940,
      tunnelDisplayHeight: 940,
    };
    const lateResize = {
      ...settled,
      time: 240,
      tunnelBackingWidth: 900,
      tunnelBackingHeight: 900,
    };

    const summary = summarizeTransitionGeometry({
      command: "tunnel-first",
      duration: 280,
      samples: [settled, lateResize],
      modeCommits: [],
    });

    expect(summary.tunnelLateBackingChanges).toBe(1);
  });

  it("retains the persistent 2D base during a 3D-to-Tunnel handoff", () => {
    const doubleFade = {
      ...sample(80, 900, 1),
      phase: "prepare-tunnel-from-3d" as const,
      selectedMode: "tunnel" as const,
      motion2DOpacity: 0,
      motion3DOpacity: 0.6,
      tunnelOpacity: 0.4,
      tunnelPresented: true,
      tunnelCanvasReady: true,
    };
    const blank = {
      ...doubleFade,
      time: 160,
      motion3DOpacity: 0,
      tunnelOpacity: 0,
    };

    const summary = summarizeTransitionGeometry({
      command: "tunnel-3d",
      duration: 200,
      samples: [sample(0, 900, 1), doubleFade, blank],
      modeCommits: [],
    });

    expect(summary.tunnelDoubleFadeFrames).toBe(1);
    expect(summary.tunnelBlankFrames).toBe(0);
    expect(summary.tunnelSurfacePath).toEqual([
      "2D base",
      "2D base + Tunnel layers",
      "2D base",
    ]);
  });

  it("flags remounted inspector and Animator identities", () => {
    const first = {
      ...sample(0, 900, 1),
      inspectorIdentity: 4,
      animatorIdentity: 7,
    };
    const remounted = {
      ...first,
      time: 160,
      inspectorIdentity: 5,
      animatorIdentity: 8,
    };

    const summary = summarizeTransitionGeometry({
      command: "tunnel-first",
      duration: 160,
      samples: [first, remounted],
      modeCommits: [],
    });

    expect(summary.tunnelInspectorIdentityChanges).toBe(1);
    expect(summary.tunnelAnimatorIdentityChanges).toBe(1);
  });
});
