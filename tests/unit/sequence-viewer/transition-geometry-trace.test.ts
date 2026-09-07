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
    mandalaDisplayWidth: 630,
    mandalaDisplayHeight: 630,
    mandalaMaximumRasterScale: 1,
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
    effectsInspectorOpacity: 0,
    cardEffectsSeamGap: 0,
    desktopInspectorExpected: true,
    cardSettingsWidth: 0,
    cardSettingsHeight: 0,
    cardSettingsCenterY: 0,
    cardSettingsOpacity: 0,
    cardIdentity: 1,
    dissolveActive: false,
    animationOpacity,
    cardOpacity: 1,
    motion2DOpacity: 1,
    motion3DOpacity: 0,
    motion2DPresented: true,
    motion3DPresented: false,
    motion3DReady: false,
    motion3DPreparing: false,
    motion2DPreparationHeld: false,
    sceneCurtainVisible: false,
    scenePreparationProgress: null,
    scenePreparationLabel: null,
    tunnelOpacity: 0,
    tunnelLayersReady: false,
    tunnelLayerCount: 0,
    tunnelPreparedLayerCount: 0,
    tunnelTextureRequestedCount: 0,
    tunnelTextureLoadedCount: 0,
    tunnelTextureReadyCount: 0,
    tunnelLayerOpacityMinimum: 0,
    tunnelLayerOpacityMaximum: 0,
    tunnelLayerOpacityMean: 0,
    tunnelPerceptibleLayerCount: 0,
    tunnelMovingLayerCount: 0,
    tunnelTrailSuppressedLayerCount: 0,
    tunnelFormationPoseDrift: 0,
    tunnelGridOpacity: 1,
    tunnelPaintFrame: 0,
    tunnelPaintedPropCount: 0,
    tunnelPaintedPerceptiblePropCount: 0,
    tunnelPaintedOpacityMean: 0,
    tunnelFormationTrailCaptures: 0,
    tunnelPresented: false,
    tunnelCanvasReady: true,
    animatorIdentity: 1,
    animatorCanvasCount: 1,
    activeArtSettingsCount: 0,
    artSettingsOpacity: 0,
    tunnelBackingWidth: 0,
    tunnelBackingHeight: 0,
    tunnelDisplayWidth: 0,
    tunnelDisplayHeight: 0,
    stageLayerOpacity: 1,
    performanceLayerOpacity: 0,
    stageLayerIdentity: 2,
    performanceLayerIdentity: 3,
    stageLayerActive: true,
    performanceLayerActive: false,
    performanceGalleryReady: true,
    performanceLayoutColumns: 2,
    performancePlayerCount: 1,
    stageLayerWidth: 900,
    performanceLayerWidth: 900,
  };
}

function trace(samples: TransitionGeometrySample[]): TransitionGeometryTrace {
  return { command: "card", duration: 280, samples, modeCommits: [] };
}

describe("Sequence Viewer geometry trace", () => {
  it("accepts one persistent viewer stage and Performances handoff", () => {
    const stage = {
      ...sample(0, 900, 1),
      phase: "stage-to-performances" as const,
      selectedMode: "animation" as const,
      stageSize: 800,
      inspectorSize: 400,
    };
    const enteringGallery = {
      ...stage,
      time: 120,
      selectedMode: "videos" as const,
      stageSize: 1000,
      inspectorSize: 200,
      stageLayerOpacity: 0.5,
      performanceLayerOpacity: 0.5,
      stageLayerActive: false,
      performanceLayerActive: true,
    };
    const gallery = {
      ...enteringGallery,
      time: 280,
      stageSize: 1200,
      inspectorSize: 1,
      stageLayerOpacity: 0,
      performanceLayerOpacity: 1,
    };
    const leavingGallery = {
      ...gallery,
      time: 400,
      phase: "performances-to-stage" as const,
      selectedMode: "animation" as const,
      stageSize: 1000,
      inspectorSize: 200,
      stageLayerOpacity: 0.5,
      performanceLayerOpacity: 0.5,
      stageLayerActive: true,
      performanceLayerActive: false,
    };
    const returned = {
      ...leavingGallery,
      time: 560,
      stageSize: 800,
      inspectorSize: 400,
      stageLayerOpacity: 1,
      performanceLayerOpacity: 0,
    };

    const summary = summarizeTransitionGeometry({
      command: "performances-2d",
      duration: 560,
      samples: [stage, enteringGallery, gallery, leavingGallery, returned],
      modeCommits: [],
    });

    expect(summary.performanceStageIdentityChanges).toBe(0);
    expect(summary.performanceGalleryIdentityChanges).toBe(0);
    expect(summary.performanceBlankFrames).toBe(0);
    expect(summary.performanceDoubleOpaqueFrames).toBe(0);
    expect(summary.performanceLayoutChanges).toBe(0);
    expect(summary.performancePlayerCountMaximum).toBe(1);
    expect(summary.performanceCrossfadeFrames).toBe(2);
    expect(summary.performanceUnreadyFrames).toBe(0);
    expect(summary.performanceOpacityComplementDriftMaximum).toBe(0);
    expect(summary.performanceLayerWidthMismatchMaximum).toBe(0);
    expect(summary.performanceSurfacePath).toEqual([
      "Motion stage",
      "Motion stage + Performance stage",
      "Performance stage",
      "Motion stage + Performance stage",
      "Motion stage",
    ]);
    expect(summary.performanceStageExit?.backtrack).toBe(0);
    expect(summary.performanceStageEntry?.overshoot).toBe(0);
  });

  it("reports a gallery breakpoint swap while the gallery is visible", () => {
    const stacked = {
      ...sample(0, 900, 1),
      phase: "stage-to-performances" as const,
      selectedMode: "videos" as const,
      stageLayerOpacity: 0.6,
      performanceLayerOpacity: 0.4,
      performanceLayoutColumns: 1,
    };
    const columns = {
      ...stacked,
      time: 16,
      stageLayerOpacity: 0.4,
      performanceLayerOpacity: 0.6,
      performanceLayoutColumns: 2,
    };

    const summary = summarizeTransitionGeometry({
      command: "performances-2d",
      duration: 16,
      samples: [stacked, columns],
      modeCommits: [],
    });

    expect(summary.performanceLayoutChanges).toBe(1);
  });

  it("accepts one continuous Card and viewer-stage exchange with a stable inspector", () => {
    const cardStart = {
      ...sample(0, 0, 0),
      phase: "card-to-stage" as const,
      selectedMode: "card" as const,
      cardPanelCenterX: 600,
      cardContentCenterX: 600,
      cardSettingsOpacity: 1,
      inspectorSize: 560,
    };
    const crossing = {
      ...cardStart,
      time: 120,
      selectedMode: "animation" as const,
      animationSize: 450,
      animationOpacity: 1,
      cardPanelCenterX: 750,
      cardContentCenterX: 750,
      cardSettingsOpacity: 0.5,
      effectsInspectorOpacity: 0.5,
    };
    const stage = {
      ...crossing,
      time: 280,
      animationSize: 900,
      cardPanelCenterX: 900,
      cardContentCenterX: 900,
      cardOpacity: 0,
      cardSettingsOpacity: 0,
      effectsInspectorOpacity: 1,
    };
    const returnCrossing = {
      ...crossing,
      phase: "stage-to-card" as const,
      time: 400,
    };
    const cardEnd = {
      ...cardStart,
      phase: "stage-to-card" as const,
      time: 560,
    };

    const summary = summarizeTransitionGeometry({
      command: "card-2d",
      duration: 560,
      samples: [cardStart, crossing, stage, returnCrossing, cardEnd],
      modeCommits: [],
    });

    expect(summary.cardStageCardIdentityChanges).toBe(0);
    expect(summary.cardStageAnimatorIdentityChanges).toBe(0);
    expect(summary.cardStageInspectorIdentityChanges).toBe(0);
    expect(summary.cardStageSplitFrames).toBe(0);
    expect(summary.cardStageBlankFrames).toBe(0);
    expect(summary.cardStageSettingsBlankFrames).toBe(0);
    expect(summary.cardStageSettingsCrossfadeFrames).toBe(2);
    expect(summary.cardStageExitTravel).toMatchObject({
      backtrack: 0,
      overshoot: 0,
    });
    expect(summary.cardStageEntryTravel).toMatchObject({
      backtrack: 0,
      overshoot: 0,
    });
    expect(summary.cardStageInspectorSize?.variation).toBe(0);
    expect(summary.cardStageInspectorExit).toMatchObject({
      start: 560,
      end: 560,
      backtrack: 0,
      overshoot: 0,
    });
    expect(summary.cardStageInspectorEntry).toMatchObject({
      start: 560,
      end: 560,
      backtrack: 0,
      overshoot: 0,
    });
  });

  it("accepts an intentional monotonic inspector release for 3D", () => {
    const card = {
      ...sample(0, 0, 0),
      phase: "card-to-stage" as const,
      selectedMode: "card" as const,
      inspectorSize: 560,
    };
    const closing = {
      ...card,
      time: 120,
      selectedMode: "animation-3d" as const,
      inspectorSize: 280,
    };
    const stage = { ...closing, time: 280, inspectorSize: 4 };
    const opening = {
      ...closing,
      phase: "stage-to-card" as const,
      time: 400,
    };
    const restored = {
      ...card,
      phase: "stage-to-card" as const,
      time: 560,
    };

    const summary = summarizeTransitionGeometry({
      command: "card-3d",
      duration: 560,
      samples: [card, closing, stage, opening, restored],
      modeCommits: [],
    });

    expect(summary.cardStageInspectorExit).toMatchObject({
      start: 560,
      end: 4,
      backtrack: 0,
      overshoot: 0,
    });
    expect(summary.cardStageInspectorEntry).toMatchObject({
      start: 280,
      end: 560,
      backtrack: 0,
      overshoot: 0,
    });
  });

  it("flags remounts, transformed cells, and an intermediate split during a Card handoff", () => {
    const start = {
      ...sample(0, 0, 0),
      phase: "card-to-stage" as const,
      selectedMode: "card" as const,
      cardIdentity: 1,
    };
    const broken = {
      ...start,
      time: 100,
      selectedMode: "split" as const,
      cardIdentity: 2,
      cardOpacity: 0,
      animationOpacity: 0,
    };
    const transformed = {
      ...start,
      time: 50,
      selectedMode: "animation" as const,
      cardTransformedCellCount: 8,
      cardOpacity: 0.5,
      animationOpacity: 1,
    };

    const summary = summarizeTransitionGeometry({
      command: "card-2d",
      duration: 100,
      samples: [start, transformed, broken],
      modeCommits: [],
    });

    expect(summary.cardStageCardIdentityChanges).toBe(1);
    expect(summary.cardStageSplitFrames).toBe(1);
    expect(summary.cardStageBlankFrames).toBe(1);
    expect(summary.transformedCardCellFrames).toBe(1);
    expect(summary.maximumTransformedCardCells).toBe(8);
  });

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

  it("flags a 2D return that expands before settling smaller", () => {
    const summary = summarizeTransitionGeometry(
      trace([
        sample(0, 880, 1),
        sample(80, 1040, 1),
        sample(180, 760, 1),
        sample(280, 720, 1),
      ])
    );

    expect(summary.animationReturnSizeTravel).toMatchObject({
      start: 880,
      end: 720,
      backtrack: 160,
      overshoot: 0,
    });
  });

  it("accepts a monotonic 2D return into its split allocation", () => {
    const summary = summarizeTransitionGeometry(
      trace([
        sample(0, 880, 1),
        sample(80, 840, 1),
        sample(180, 770, 1),
        sample(280, 720, 1),
      ])
    );

    expect(summary.animationReturnSizeTravel).toMatchObject({
      start: 880,
      end: 720,
      backtrack: 0,
      overshoot: 0,
    });
  });

  it("measures the Card and Effects handoff as one continuous seam", () => {
    const start = {
      ...sample(0, 450, 1),
      phase: "focus-2d" as const,
      cardOpacity: 1,
      effectsInspectorOpacity: 0,
    };
    const overlap = {
      ...start,
      time: 80,
      cardOpacity: 0.55,
      effectsInspectorOpacity: 0.45,
      inspectorSize: 240,
      cardEffectsSeamGap: 0.4,
    };
    const settled = {
      ...start,
      time: 280,
      cardOpacity: 0,
      effectsInspectorOpacity: 1,
      inspectorSize: 560,
      cardEffectsSeamGap: 0,
    };

    const summary = summarizeTransitionGeometry({
      command: "2d",
      duration: 280,
      samples: [start, overlap, settled],
      modeCommits: [],
    });

    expect(summary.cardEffectsSeamGapMaximum).toBe(0.4);
    expect(summary.cardEffectsOpacityOnsetSkew).toBe(0);
    expect(summary.cardEffectsCrossfadeFrames).toBe(1);
    expect(summary.cardEffectsBlankFrames).toBe(0);
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

  it("accepts an honest first-3D preparation surface with monotonic progress", () => {
    const crossfade = {
      ...sample(40, 450, 1),
      phase: "prepare-3d" as const,
      selectedMode: "animation-3d" as const,
      motion2DOpacity: 0.7,
      motion3DOpacity: 0.3,
      motion2DPresented: false,
      motion3DPresented: true,
      motion3DPreparing: true,
      motion2DPreparationHeld: true,
      sceneCurtainVisible: true,
      scenePreparationLabel: "Opening 3D",
    };
    const preparing = {
      ...crossfade,
      time: 100,
      motion2DOpacity: 0,
      motion3DOpacity: 1,
      scenePreparationProgress: 0.42,
      scenePreparationLabel: "Setting the stage",
    };
    const warming = {
      ...preparing,
      time: 160,
      scenePreparationProgress: 0.84,
      scenePreparationLabel: "Warming up",
    };
    const ready = {
      ...warming,
      time: 220,
      phase: "show-3d" as const,
      motion3DReady: true,
      motion3DPreparing: false,
      sceneCurtainVisible: false,
      scenePreparationProgress: null,
      scenePreparationLabel: null,
    };

    const summary = summarizeTransitionGeometry({
      command: "3d-first",
      duration: 220,
      samples: [sample(0, 450, 1), crossfade, preparing, warming, ready],
      modeCommits: [],
    });

    expect(summary.motionBlankFrames).toBe(0);
    expect(summary.motionUnready3DFrames).toBe(0);
    expect(summary.motionCurtainFrames).toBe(3);
    expect(summary.motionMisidentified3DFrames).toBe(0);
    expect(summary.motionPreparationProgressRegressions).toBe(0);
    expect(summary.motionPreparationLabels).toEqual([
      "Opening 3D",
      "Setting the stage",
      "Warming up",
    ]);
    expect(summary.motionCrossfadeFrames).toBe(1);
    expect(summary.motionPreparationFrames).toBe(3);
    expect(summary.motionPreparationGeometryHeldFrames).toBe(3);
    expect(summary.motionPreparationRasterScaleMaximum).toBe(1);
    expect(summary.motionPreparationRasterGrowthMaximum).toBe(1);
    expect(summary.motionMagnifiedPreparationFrames).toBe(0);
    expect(summary.motionSurfacePath).toEqual(["2D", "3D"]);
    expect(summary.motionHandoffLatency).toBe(180);
  });

  it("flags stale 2D identity and backwards scene progress after selecting 3D", () => {
    const stale2D = {
      ...sample(40, 450, 1),
      phase: "prepare-3d" as const,
      selectedMode: "animation-3d" as const,
      motion3DPresented: true,
      motion3DPreparing: true,
      sceneCurtainVisible: true,
      scenePreparationProgress: 0.72,
      scenePreparationLabel: "Setting the stage",
    };
    const regressed = {
      ...stale2D,
      time: 80,
      motion2DPresented: false,
      scenePreparationProgress: 0.51,
    };

    const summary = summarizeTransitionGeometry({
      command: "3d-first",
      duration: 80,
      samples: [sample(0, 450, 1), stale2D, regressed],
      modeCommits: [],
    });

    expect(summary.motionMisidentified3DFrames).toBe(1);
    expect(summary.motionPreparationProgressRegressions).toBe(1);
  });

  it("flags a first-3D placeholder stretched beyond its backing raster", () => {
    const stretched = {
      ...sample(80, 900, 1),
      phase: "prepare-3d" as const,
      selectedMode: "animation-3d" as const,
      motion3DPreparing: true,
      mandalaDisplayWidth: 1260,
      mandalaDisplayHeight: 700,
      mandalaMaximumRasterScale: 2,
    };

    const summary = summarizeTransitionGeometry({
      command: "3d-first",
      duration: 80,
      samples: [sample(0, 900, 1), stretched],
      modeCommits: [],
    });

    expect(summary.motionPreparationRasterScaleMaximum).toBe(2);
    expect(summary.motionPreparationRasterGrowthMaximum).toBe(2);
    expect(summary.motionMagnifiedPreparationFrames).toBe(1);
    expect(summary.motionPreparationGeometryHeldFrames).toBe(0);
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

  it("measures whether Tunnel's painted props arrive throughout the reveal", () => {
    const reveal = [
      [0, 0, 0, 0],
      [60, 0.25, 0.22, 7],
      [120, 0.5, 0.46, 7],
      [180, 0.7, 0.65, 7],
      [240, 0.85, 0.8, 7],
      [300, 0.95, 0.93, 7],
      [360, 0.98, 0.97, 7],
      [480, 1, 1, 7],
    ].map(([time, opacity, mean, perceptible], index) => ({
      ...sample(time, 900, 1),
      phase: "show-tunnel" as const,
      selectedMode: "tunnel" as const,
      tunnelOpacity: opacity,
      tunnelLayersReady: true,
      tunnelLayerCount: 7,
      tunnelPreparedLayerCount: 7,
      tunnelLayerOpacityMinimum: mean,
      tunnelLayerOpacityMaximum: opacity,
      tunnelLayerOpacityMean: mean,
      tunnelPerceptibleLayerCount: perceptible,
      tunnelMovingLayerCount: 0,
      tunnelTrailSuppressedLayerCount: 0,
      tunnelFormationPoseDrift: 0,
      tunnelPaintFrame: index + 1,
      tunnelPaintedPropCount: opacity > 0 ? 14 : 0,
      tunnelPaintedPerceptiblePropCount: perceptible * 2,
      tunnelPaintedOpacityMean: mean,
      tunnelPresented: opacity > 0,
      tunnelCanvasReady: true,
    }));

    const summary = summarizeTransitionGeometry({
      command: "tunnel-first",
      duration: 480,
      samples: reveal,
      tunnelPaintSamples: reveal.map((sample) => ({
        time: sample.time,
        progress: sample.tunnelOpacity,
        paintedPropCount: sample.tunnelPaintedPropCount,
        perceptiblePropCount: sample.tunnelPaintedPerceptiblePropCount,
        meanAlpha: sample.tunnelPaintedOpacityMean,
      })),
      modeCommits: [],
    });

    expect(summary.tunnelAllLayersPerceptibleProgress).toBe(0.25);
    expect(summary.tunnelLayerMeanOpacityAtHalf).toBe(0.46);
    expect(summary.tunnelPaintedArrival).toMatchObject({
      peakProps: 14,
      allPropsPerceptibleProgress: 0.25,
      quarterMeanAlpha: 0.22,
      halfwayMeanAlpha: 0.46,
      growthFrames: 5,
      durationMs: 480,
    });
    expect(summary.tunnelUnguardedFormationFrames).toBe(0);
    expect(summary.tunnelFormationTrailCaptures).toBe(0);
    expect(summary.tunnelFormationPoseDriftMaximum).toBe(0);
    expect(summary.tunnelFormationPoseDriftFrames).toBe(0);
  });

  it("flags trail samples accepted during Tunnel formation travel", () => {
    const trace: TransitionGeometryTrace = {
      command: "tunnel-first",
      duration: 32,
      samples: [
        sample(0, 900, 1),
        {
          ...sample(16, 900, 1),
          selectedMode: "tunnel",
          phase: "show-tunnel",
          tunnelOpacity: 0.4,
          tunnelLayerCount: 7,
          tunnelMovingLayerCount: 7,
          tunnelTrailSuppressedLayerCount: 5,
          tunnelFormationPoseDrift: 0.4,
          tunnelFormationTrailCaptures: 3,
        },
      ],
      modeCommits: [],
    };

    const summary = summarizeTransitionGeometry(trace);

    expect(summary.tunnelUnguardedFormationFrames).toBe(1);
    expect(summary.tunnelFormationTrailCaptures).toBe(3);
    expect(summary.tunnelFormationPoseDriftMaximum).toBe(0.4);
    expect(summary.tunnelFormationPoseDriftFrames).toBe(1);
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
