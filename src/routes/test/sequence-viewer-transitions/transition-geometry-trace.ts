export type TransitionTraceCommand =
  | "2d"
  | "card"
  | "interrupt"
  | "3d-first"
  | "3d-repeat"
  | "3d-interrupt"
  | "tunnel-first"
  | "tunnel-3d"
  | "tunnel-interrupt";

export type TransitionTracePhase =
  | "focus-2d"
  | "focus-card"
  | "return-split"
  | "interrupt-2d"
  | "interrupt-split"
  | "interrupt-card"
  | "interrupt-return"
  | "prepare-3d"
  | "show-3d"
  | "return-2d"
  | "repeat-3d"
  | "interrupt-3d"
  | "interrupt-2d-return"
  | "prepare-tunnel"
  | "show-tunnel"
  | "return-stage"
  | "prepare-tunnel-from-3d"
  | "return-3d"
  | "interrupt-tunnel"
  | "interrupt-stage";

export interface TransitionGeometrySample {
  time: number;
  phase: TransitionTracePhase;
  direction: "horizontal" | "vertical";
  focusedPane: string | null;
  selectedMode:
    "split" | "animation" | "animation-3d" | "card" | "tunnel" | null;
  outerDirection: "horizontal" | "vertical";
  stageSize: number;
  stageFlexGrow: number;
  animationSize: number;
  animationFlexGrow: number;
  animationHidden: boolean;
  animationReadable: boolean;
  mandalaBackingSize: number;
  mandalaDisplaySize: number;
  mandalaRasterScale: number;
  mandalaDisplayWidth: number;
  mandalaDisplayHeight: number;
  mandalaMaximumRasterScale: number;
  cardSize: number;
  cardFlexGrow: number;
  cardHidden: boolean;
  cardReadable: boolean;
  cardPanelWidth: number;
  cardPanelHeight: number;
  cardPanelCenterX: number;
  cardPanelCenterY: number;
  cardRootWidth: number;
  cardRootHeight: number;
  cardRootCenterY: number;
  cardContentWidth: number;
  cardContentHeight: number;
  cardContentCenterX: number;
  cardContentCenterY: number;
  cardTransformedCellCount: number;
  cardColumns: number;
  cardRows: number;
  cardAutoLayoutLocked: boolean;
  cardAutoLayoutLockColumns: number;
  cardAutoLayoutLockRows: number;
  inspectorSize: number;
  inspectorFlexGrow: number;
  inspectorIdentity: number;
  effectsInspectorOpacity: number;
  cardEffectsSeamGap: number;
  desktopInspectorExpected: boolean;
  cardSettingsWidth: number;
  cardSettingsHeight: number;
  cardSettingsCenterY: number;
  cardSettingsOpacity: number;
  dissolveActive: boolean;
  animationOpacity: number;
  cardOpacity: number;
  motion2DOpacity: number;
  motion3DOpacity: number;
  motion2DPresented: boolean;
  motion3DPresented: boolean;
  motion3DReady: boolean;
  motion3DPreparing: boolean;
  motion2DPreparationHeld: boolean;
  sceneCurtainVisible: boolean;
  scenePreparationProgress: number | null;
  scenePreparationLabel: string | null;
  tunnelOpacity: number;
  tunnelPresented: boolean;
  tunnelCanvasReady: boolean;
  animatorIdentity: number;
  animatorCanvasCount: number;
  activeArtSettingsCount: number;
  tunnelBackingWidth: number;
  tunnelBackingHeight: number;
  tunnelDisplayWidth: number;
  tunnelDisplayHeight: number;
}

export interface TransitionGeometryTrace {
  command: TransitionTraceCommand;
  duration: number;
  samples: TransitionGeometrySample[];
  modeCommits: Array<{
    mode: "split" | "animation" | "animation-3d" | "card" | "tunnel";
    latency: number;
  }>;
}

export interface TransitionGeometrySummary {
  cardExitMinimum: number | null;
  cardEntryMinimum: number | null;
  animationExitMinimum: number | null;
  animationEntryMinimum: number | null;
  tinyCardFrames: number;
  tinyAnimationFrames: number;
  mandalaReturnRasterScaleMaximum: number | null;
  magnifiedMandalaReturnFrames: number;
  dissolveFrames: number;
  cardBoxMinimum: { width: number; height: number } | null;
  cardAspectMinimum: number | null;
  cardAspectMaximum: number | null;
  squashedCardFrames: number;
  dissolveCoveredCardFrames: number;
  transformedCardCellFrames: number;
  maximumTransformedCardCells: number;
  modePath: string[];
  panelDirectionPath: string[];
  outerDirectionPath: string[];
  cardLayoutPath: string[];
  cardLayoutLockPath: string[];
  cardReturnPanelWidth: TransitionEndpointUndershoot | null;
  cardReturnPanelHeight: TransitionEndpointUndershoot | null;
  cardReturnRootWidth: TransitionEndpointUndershoot | null;
  cardReturnRootHeight: TransitionEndpointUndershoot | null;
  cardReturnVisualWidth: TransitionEndpointUndershoot | null;
  cardReturnVisualHeight: TransitionEndpointUndershoot | null;
  cardReturnTravel: TransitionTravelSummary | null;
  cardSettingsFocusWidth: TransitionValueRange | null;
  cardSettingsFocusHeight: TransitionValueRange | null;
  cardSettingsFocusCenterY: TransitionValueRange | null;
  cardSettingsReturnWidth: TransitionValueRange | null;
  cardSettingsReturnHeight: TransitionValueRange | null;
  cardSettingsReturnCenterY: TransitionValueRange | null;
  cardEffectsSeamGapMaximum: number;
  cardEffectsOpacityOnsetSkew: number | null;
  cardEffectsCrossfadeFrames: number;
  cardEffectsBlankFrames: number;
  motionBlankFrames: number;
  motionUnready3DFrames: number;
  motionCurtainFrames: number;
  motionMisidentified3DFrames: number;
  motionPreparationProgressRegressions: number;
  motionPreparationLabels: string[];
  motionCrossfadeFrames: number;
  motionPreparationFrames: number;
  motionPreparationGeometryHeldFrames: number;
  motionPreparationRasterScaleMaximum: number | null;
  motionPreparationRasterGrowthMaximum: number | null;
  motionMagnifiedPreparationFrames: number;
  motionLate2DBackingChanges: number;
  motionSurfacePath: string[];
  motionHandoffLatency: number | null;
  motionStageSize: TransitionValueRange | null;
  motionInspectorSize: TransitionValueRange | null;
  tunnelUnreadyFrames: number;
  tunnelCrossfadeFrames: number;
  tunnelDoubleFadeFrames: number;
  tunnelBlankFrames: number;
  tunnelLateBackingChanges: number;
  tunnelInspectorIdentityChanges: number;
  tunnelAnimatorIdentityChanges: number;
  tunnelDuplicateCanvasFrames: number;
  tunnelDuplicateSettingsFrames: number;
  tunnelSurfacePath: string[];
  tunnelHandoffLatency: number | null;
  tunnelStageSize: TransitionValueRange | null;
  tunnelDisplaySize: TransitionValueRange | null;
}

export interface TransitionEndpointUndershoot {
  start: number;
  end: number;
  minimum: number;
  undershoot: number;
  minimumTime: number;
}

export interface TransitionTravelSummary {
  start: number;
  end: number;
  minimum: number;
  maximum: number;
  backtrack: number;
  overshoot: number;
}

export interface TransitionValueRange {
  start: number;
  end: number;
  minimum: number;
  maximum: number;
  variation: number;
}

export const READABLE_PANE_SIZE = 180;
export const VISIBLE_PANE_OPACITY = 0.15;
export const MAX_MANDALA_RASTER_SCALE = 1.08;
// Auto's canonical 3×4 Card is about 0.69 once its header/footer are included.
// Anything below 0.6 represents a transient pencil-thin recomposition rather
// than an intentional portrait Card.
export const MIN_CARD_ASPECT_RATIO = 0.6;
export const MAX_CARD_ASPECT_RATIO = 1.8;

function cardExpectedToRemainReadable(
  trace: TransitionGeometryTrace,
  sample: TransitionGeometrySample
): boolean {
  if (trace.command === "card") {
    return sample.phase === "focus-card" || sample.phase === "return-split";
  }

  if (trace.command === "interrupt") {
    // The replay labels the next leg immediately before its click. Ignore the
    // covered Card's final pre-click sample; once its opacity becomes readable,
    // the same geometry checks apply and catch any surface a person can see.
    return (
      sample.phase === "interrupt-card" &&
      sample.cardOpacity >= VISIBLE_PANE_OPACITY
    );
  }

  return sample.cardOpacity >= VISIBLE_PANE_OPACITY;
}

function uniqueModePath(samples: TransitionGeometrySample[]): string[] {
  const path: string[] = [];
  for (const sample of samples) {
    if (!sample.selectedMode || path.at(-1) === sample.selectedMode) continue;
    path.push(sample.selectedMode);
  }
  return path;
}

function uniqueValuePath<T extends string | number>(values: T[]): T[] {
  const path: T[] = [];
  for (const value of values) {
    if (path.at(-1) !== value) path.push(value);
  }
  return path;
}

function uniqueCardLayoutPath(samples: TransitionGeometrySample[]): string[] {
  const path: string[] = [];
  for (const sample of samples) {
    const layout = `${sample.cardColumns}×${sample.cardRows}`;
    if (
      sample.cardColumns < 1 ||
      sample.cardRows < 1 ||
      path.at(-1) === layout
    ) {
      continue;
    }
    path.push(layout);
  }
  return path;
}

function uniqueCardLayoutLockPath(
  samples: TransitionGeometrySample[]
): string[] {
  const path: string[] = [];
  for (const sample of samples) {
    const state = sample.cardAutoLayoutLocked
      ? `locked ${sample.cardAutoLayoutLockColumns}×${sample.cardAutoLayoutLockRows}`
      : "free";
    if (path.at(-1) !== state) path.push(state);
  }
  return path;
}

function uniqueMotionSurfacePath(
  samples: TransitionGeometrySample[]
): string[] {
  return uniqueValuePath(
    samples.map((sample) => {
      if (sample.motion2DPresented && sample.motion3DPresented) {
        return "2D + 3D";
      }
      if (sample.motion3DPresented) return "3D";
      if (sample.motion2DPresented) return "2D";
      return "hidden";
    })
  );
}

function minimumVisibleSize(
  samples: TransitionGeometrySample[],
  phase: TransitionTracePhase,
  size: (sample: TransitionGeometrySample) => number,
  opacity: (sample: TransitionGeometrySample) => number
): number | null {
  const visibleSizes = samples
    .filter(
      (sample) =>
        sample.phase === phase && opacity(sample) >= VISIBLE_PANE_OPACITY
    )
    .map(size);

  return visibleSizes.length > 0 ? Math.min(...visibleSizes) : null;
}

function endpointUndershoot(
  samples: TransitionGeometrySample[],
  value: (sample: TransitionGeometrySample) => number
): TransitionEndpointUndershoot | null {
  const returnSamples = samples.filter(
    (sample) => sample.phase === "return-split" && value(sample) > 0
  );
  if (returnSamples.length < 2) return null;

  const start = value(returnSamples[0]);
  const end = value(returnSamples.at(-1)!);
  const minimumSample = returnSamples.reduce((minimum, sample) =>
    value(sample) < value(minimum) ? sample : minimum
  );
  const minimum = value(minimumSample);
  return {
    start,
    end,
    minimum,
    undershoot: Math.max(0, Math.min(start, end) - minimum),
    minimumTime: minimumSample.time,
  };
}

function travelSummary(
  samples: TransitionGeometrySample[],
  value: (sample: TransitionGeometrySample) => number
): TransitionTravelSummary | null {
  const returnValues = samples
    .filter((sample) => sample.phase === "return-split" && value(sample) > 0)
    .map(value);
  if (returnValues.length < 2) return null;

  const start = returnValues[0];
  const end = returnValues.at(-1)!;
  const minimum = Math.min(...returnValues);
  const maximum = Math.max(...returnValues);
  const movingRight = end >= start;
  return {
    start,
    end,
    minimum,
    maximum,
    backtrack: movingRight
      ? Math.max(0, start - minimum)
      : Math.max(0, maximum - start),
    overshoot: movingRight
      ? Math.max(0, maximum - end)
      : Math.max(0, end - minimum),
  };
}

function visiblePhaseRange(
  samples: TransitionGeometrySample[],
  phase: TransitionTracePhase,
  value: (sample: TransitionGeometrySample) => number
): TransitionValueRange | null {
  const values = samples
    .filter(
      (sample) =>
        sample.phase === phase &&
        sample.cardSettingsOpacity >= VISIBLE_PANE_OPACITY &&
        value(sample) > 0
    )
    .map(value);
  if (values.length === 0) return null;

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return {
    start: values[0],
    end: values.at(-1)!,
    minimum,
    maximum,
    variation: maximum - minimum,
  };
}

function cardEffectsOpacityOnsetSkew(
  samples: TransitionGeometrySample[]
): number | null {
  const handoff = samples.filter(
    (sample) => sample.phase === "focus-2d" && sample.desktopInspectorExpected
  );
  const first = handoff[0];
  if (!first || handoff.some((sample) => sample.dissolveActive)) return null;

  const cardOnset = handoff.find(
    (sample) => sample.cardOpacity < first.cardOpacity - 0.02
  );
  const effectsOnset = handoff.find(
    (sample) =>
      sample.effectsInspectorOpacity > first.effectsInspectorOpacity + 0.02
  );
  if (!cardOnset || !effectsOnset) return null;
  return Math.abs(cardOnset.time - effectsOnset.time);
}

function valueRange(
  samples: TransitionGeometrySample[],
  value: (sample: TransitionGeometrySample) => number
): TransitionValueRange | null {
  const values = samples.map(value).filter((candidate) => candidate > 0);
  if (values.length === 0) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return {
    start: values[0],
    end: values.at(-1)!,
    minimum,
    maximum,
    variation: maximum - minimum,
  };
}

function visibleTunnelRange(
  samples: TransitionGeometrySample[],
  value: (sample: TransitionGeometrySample) => number
): TransitionValueRange | null {
  return valueRange(
    samples.filter((sample) => sample.tunnelOpacity >= 0.05),
    value
  );
}

export function tunnelStageOpacity(sample: TransitionGeometrySample): number {
  return Math.max(sample.motion2DOpacity, sample.motion3DOpacity);
}

function motionHandoffLatency(trace: TransitionGeometryTrace): number | null {
  if (!trace.command.startsWith("3d")) return null;
  const request = trace.samples.find(
    (sample) => sample.selectedMode === "animation-3d"
  );
  if (!request) return null;
  const reveal = trace.samples.find(
    (sample) =>
      sample.time >= request.time &&
      sample.motion3DPresented &&
      sample.motion3DReady
  );
  return reveal ? Math.max(0, reveal.time - request.time) : null;
}

function late2DBackingChanges(samples: TransitionGeometrySample[]): number {
  const settledReturn = samples.filter(
    (sample) =>
      sample.phase === "return-2d" &&
      sample.motion2DPresented &&
      sample.motion2DOpacity >= 0.99 &&
      sample.mandalaBackingSize > 0
  );
  let changes = 0;
  for (let index = 1; index < settledReturn.length; index += 1) {
    if (
      Math.abs(
        settledReturn[index].mandalaBackingSize -
          settledReturn[index - 1].mandalaBackingSize
      ) > 0.5
    ) {
      changes += 1;
    }
  }
  return changes;
}

function preparationProgressRegressions(
  samples: TransitionGeometrySample[]
): number {
  let previous: number | null = null;
  let regressions = 0;
  for (const sample of samples) {
    if (!sample.sceneCurtainVisible || sample.scenePreparationProgress === null)
      continue;
    if (
      previous !== null &&
      sample.scenePreparationProgress < previous - 0.001
    ) {
      regressions += 1;
    }
    previous = sample.scenePreparationProgress;
  }
  return regressions;
}

function uniqueTunnelSurfacePath(
  samples: TransitionGeometrySample[]
): string[] {
  return uniqueValuePath(
    samples.map((sample) => {
      if (sample.tunnelOpacity >= 0.95) return "Tunnel";
      if (sample.tunnelOpacity >= 0.05) return "2D base + Tunnel layers";
      return sample.tunnelCanvasReady ? "2D base" : "Blank";
    })
  );
}

function identityChanges(
  samples: TransitionGeometrySample[],
  identity: (sample: TransitionGeometrySample) => number
): number {
  const path = uniqueValuePath(
    samples.map(identity).filter((candidate) => candidate > 0)
  );
  return Math.max(0, path.length - 1);
}

function tunnelHandoffLatency(trace: TransitionGeometryTrace): number | null {
  if (!trace.command.startsWith("tunnel")) return null;
  const request = trace.samples.find(
    (sample) => sample.selectedMode === "tunnel"
  );
  if (!request) return null;
  const reveal = trace.samples.find(
    (sample) =>
      sample.time >= request.time &&
      sample.tunnelPresented &&
      sample.tunnelCanvasReady &&
      sample.tunnelOpacity >= 0.05
  );
  return reveal ? Math.max(0, reveal.time - request.time) : null;
}

function lateTunnelBackingChanges(samples: TransitionGeometrySample[]): number {
  const settledTunnel = samples.filter(
    (sample) =>
      sample.tunnelPresented &&
      sample.tunnelCanvasReady &&
      sample.tunnelOpacity >= 0.99 &&
      sample.tunnelBackingWidth > 0 &&
      sample.tunnelBackingHeight > 0
  );
  let changes = 0;
  for (let index = 1; index < settledTunnel.length; index += 1) {
    const previous = settledTunnel[index - 1];
    const current = settledTunnel[index];
    if (
      Math.abs(current.tunnelBackingWidth - previous.tunnelBackingWidth) >
        0.5 ||
      Math.abs(current.tunnelBackingHeight - previous.tunnelBackingHeight) > 0.5
    ) {
      changes += 1;
    }
  }
  return changes;
}

export function summarizeTransitionGeometry(
  trace: TransitionGeometryTrace
): TransitionGeometrySummary {
  const isMotionTrace = trace.command.startsWith("3d");
  const isTunnelTrace = trace.command.startsWith("tunnel");
  const tinyCardFrames = trace.samples.filter(
    (sample) =>
      !sample.dissolveActive &&
      sample.cardOpacity >= VISIBLE_PANE_OPACITY &&
      sample.cardContentWidth < READABLE_PANE_SIZE
  ).length;
  const tinyAnimationFrames = trace.samples.filter(
    (sample) =>
      !sample.dissolveActive &&
      sample.animationOpacity >= VISIBLE_PANE_OPACITY &&
      sample.animationSize < READABLE_PANE_SIZE
  ).length;
  const mandalaReturnSamples = trace.samples.filter(
    (sample) => sample.phase === "return-split" && sample.mandalaRasterScale > 0
  );
  const magnifiedMandalaReturnFrames = mandalaReturnSamples.filter(
    (sample) => sample.mandalaRasterScale > MAX_MANDALA_RASTER_SCALE
  ).length;
  const expectedCardSamples = trace.samples.filter(
    (sample) =>
      cardExpectedToRemainReadable(trace, sample) && !sample.dissolveActive
  );
  const cardAspectRatios = expectedCardSamples
    .filter(
      (sample) => sample.cardContentWidth > 0 && sample.cardContentHeight > 0
    )
    .map((sample) => sample.cardContentWidth / sample.cardContentHeight);
  const cardIsSquashed = (sample: TransitionGeometrySample): boolean => {
    const { cardContentWidth: width, cardContentHeight: height } = sample;
    if (width < READABLE_PANE_SIZE || height < READABLE_PANE_SIZE) return true;
    const aspectRatio = width / height;
    return (
      aspectRatio < MIN_CARD_ASPECT_RATIO || aspectRatio > MAX_CARD_ASPECT_RATIO
    );
  };
  const squashedCardFrames = expectedCardSamples.filter(cardIsSquashed).length;
  const dissolveCoveredCardFrames = trace.samples.filter(
    (sample) =>
      sample.dissolveActive &&
      cardExpectedToRemainReadable(trace, sample) &&
      cardIsSquashed(sample)
  ).length;
  const transformedCardCellSamples = expectedCardSamples.filter(
    (sample) => sample.cardTransformedCellCount > 0
  );
  const motionPreparationSamples = isMotionTrace
    ? trace.samples.filter(
        (sample) =>
          sample.phase === "prepare-3d" &&
          sample.motion3DPreparing &&
          sample.motion2DOpacity >= VISIBLE_PANE_OPACITY &&
          sample.mandalaMaximumRasterScale > 0
      )
    : [];
  const motionPreparationRasterBaseline = isMotionTrace
    ? (trace.samples.find(
        (sample) =>
          !sample.motion3DPreparing &&
          sample.motion2DPresented &&
          sample.motion2DOpacity >= VISIBLE_PANE_OPACITY &&
          sample.mandalaMaximumRasterScale > 0
      )?.mandalaMaximumRasterScale ??
      motionPreparationSamples[0]?.mandalaMaximumRasterScale ??
      null)
    : null;
  const magnifiedMotionPreparationSamples = motionPreparationSamples.filter(
    (sample) =>
      motionPreparationRasterBaseline !== null &&
      sample.mandalaMaximumRasterScale / motionPreparationRasterBaseline >
        MAX_MANDALA_RASTER_SCALE
  );

  return {
    cardExitMinimum: minimumVisibleSize(
      trace.samples,
      "focus-2d",
      (sample) => sample.cardContentWidth,
      (sample) => sample.cardOpacity
    ),
    cardEntryMinimum: minimumVisibleSize(
      trace.samples,
      "return-split",
      (sample) => sample.cardContentWidth,
      (sample) => sample.cardOpacity
    ),
    animationExitMinimum: minimumVisibleSize(
      trace.samples,
      "focus-card",
      (sample) => sample.animationSize,
      (sample) => sample.animationOpacity
    ),
    animationEntryMinimum: minimumVisibleSize(
      trace.samples,
      "return-split",
      (sample) => sample.animationSize,
      (sample) => sample.animationOpacity
    ),
    tinyCardFrames,
    tinyAnimationFrames,
    mandalaReturnRasterScaleMaximum:
      mandalaReturnSamples.length === 0
        ? null
        : Math.max(
            ...mandalaReturnSamples.map((sample) => sample.mandalaRasterScale)
          ),
    magnifiedMandalaReturnFrames,
    dissolveFrames: trace.samples.filter((sample) => sample.dissolveActive)
      .length,
    cardBoxMinimum:
      expectedCardSamples.length === 0
        ? null
        : {
            width: Math.min(
              ...expectedCardSamples.map((sample) => sample.cardContentWidth)
            ),
            height: Math.min(
              ...expectedCardSamples.map((sample) => sample.cardContentHeight)
            ),
          },
    cardAspectMinimum:
      cardAspectRatios.length === 0 ? null : Math.min(...cardAspectRatios),
    cardAspectMaximum:
      cardAspectRatios.length === 0 ? null : Math.max(...cardAspectRatios),
    squashedCardFrames,
    dissolveCoveredCardFrames,
    transformedCardCellFrames: transformedCardCellSamples.length,
    maximumTransformedCardCells:
      transformedCardCellSamples.length === 0
        ? 0
        : Math.max(
            ...transformedCardCellSamples.map(
              (sample) => sample.cardTransformedCellCount
            )
          ),
    modePath: uniqueModePath(trace.samples),
    panelDirectionPath: uniqueValuePath(
      trace.samples.map((sample) => sample.direction)
    ),
    outerDirectionPath: uniqueValuePath(
      trace.samples.map((sample) => sample.outerDirection)
    ),
    cardLayoutPath: uniqueCardLayoutPath(trace.samples),
    cardLayoutLockPath: uniqueCardLayoutLockPath(trace.samples),
    cardReturnPanelWidth: endpointUndershoot(
      trace.samples,
      (sample) => sample.cardPanelWidth
    ),
    cardReturnPanelHeight: endpointUndershoot(
      trace.samples,
      (sample) => sample.cardPanelHeight
    ),
    cardReturnRootWidth: endpointUndershoot(
      trace.samples,
      (sample) => sample.cardRootWidth
    ),
    cardReturnRootHeight: endpointUndershoot(
      trace.samples,
      (sample) => sample.cardRootHeight
    ),
    cardReturnVisualWidth: endpointUndershoot(
      trace.samples,
      (sample) => sample.cardContentWidth
    ),
    cardReturnVisualHeight: endpointUndershoot(
      trace.samples,
      (sample) => sample.cardContentHeight
    ),
    cardReturnTravel: travelSummary(
      trace.samples,
      (sample) => sample.cardContentCenterX
    ),
    cardSettingsFocusWidth: visiblePhaseRange(
      trace.samples,
      "focus-card",
      (sample) => sample.cardSettingsWidth
    ),
    cardSettingsFocusHeight: visiblePhaseRange(
      trace.samples,
      "focus-card",
      (sample) => sample.cardSettingsHeight
    ),
    cardSettingsFocusCenterY: visiblePhaseRange(
      trace.samples,
      "focus-card",
      (sample) => sample.cardSettingsCenterY
    ),
    cardSettingsReturnWidth: visiblePhaseRange(
      trace.samples,
      "return-split",
      (sample) => sample.cardSettingsWidth
    ),
    cardSettingsReturnHeight: visiblePhaseRange(
      trace.samples,
      "return-split",
      (sample) => sample.cardSettingsHeight
    ),
    cardSettingsReturnCenterY: visiblePhaseRange(
      trace.samples,
      "return-split",
      (sample) => sample.cardSettingsCenterY
    ),
    cardEffectsSeamGapMaximum: Math.max(
      0,
      ...trace.samples
        .filter(
          (sample) =>
            sample.phase === "focus-2d" &&
            sample.desktopInspectorExpected &&
            sample.cardPanelWidth > 0 &&
            sample.inspectorSize > 0
        )
        .map((sample) => sample.cardEffectsSeamGap)
    ),
    cardEffectsOpacityOnsetSkew: cardEffectsOpacityOnsetSkew(trace.samples),
    cardEffectsCrossfadeFrames: trace.samples.filter(
      (sample) =>
        sample.phase === "focus-2d" &&
        sample.desktopInspectorExpected &&
        !sample.dissolveActive &&
        sample.cardOpacity >= 0.05 &&
        sample.effectsInspectorOpacity >= 0.05
    ).length,
    cardEffectsBlankFrames: trace.samples.filter(
      (sample) =>
        sample.phase === "focus-2d" &&
        sample.desktopInspectorExpected &&
        !sample.dissolveActive &&
        sample.cardOpacity < 0.05 &&
        sample.effectsInspectorOpacity < 0.05
    ).length,
    motionBlankFrames: isMotionTrace
      ? trace.samples.filter(
          (sample) =>
            !sample.dissolveActive &&
            sample.motion2DOpacity < 0.05 &&
            sample.motion3DOpacity < 0.05
        ).length
      : 0,
    motionUnready3DFrames: isMotionTrace
      ? trace.samples.filter(
          (sample) =>
            sample.motion3DPresented &&
            !sample.motion3DReady &&
            !sample.sceneCurtainVisible
        ).length
      : 0,
    motionCurtainFrames: isMotionTrace
      ? trace.samples.filter(
          (sample) => sample.motion3DPresented && sample.sceneCurtainVisible
        ).length
      : 0,
    motionMisidentified3DFrames: isMotionTrace
      ? trace.samples.filter(
          (sample) =>
            !sample.dissolveActive &&
            sample.selectedMode === "animation-3d" &&
            sample.motion2DPresented
        ).length
      : 0,
    motionPreparationProgressRegressions: isMotionTrace
      ? preparationProgressRegressions(trace.samples)
      : 0,
    motionPreparationLabels: isMotionTrace
      ? uniqueValuePath(
          trace.samples
            .map((sample) => sample.scenePreparationLabel)
            .filter((label): label is string => Boolean(label))
        )
      : [],
    motionCrossfadeFrames: isMotionTrace
      ? trace.samples.filter(
          (sample) =>
            sample.motion2DOpacity >= 0.05 && sample.motion3DOpacity >= 0.05
        ).length
      : 0,
    motionPreparationFrames: isMotionTrace
      ? trace.samples.filter((sample) => sample.motion3DPreparing).length
      : 0,
    motionPreparationGeometryHeldFrames: isMotionTrace
      ? trace.samples.filter(
          (sample) => sample.motion3DPreparing && sample.motion2DPreparationHeld
        ).length
      : 0,
    motionPreparationRasterScaleMaximum:
      motionPreparationSamples.length === 0
        ? null
        : Math.max(
            ...motionPreparationSamples.map(
              (sample) => sample.mandalaMaximumRasterScale
            )
          ),
    motionPreparationRasterGrowthMaximum:
      motionPreparationSamples.length === 0 ||
      motionPreparationRasterBaseline === null
        ? null
        : Math.max(
            ...motionPreparationSamples.map(
              (sample) =>
                sample.mandalaMaximumRasterScale /
                motionPreparationRasterBaseline
            )
          ),
    motionMagnifiedPreparationFrames: magnifiedMotionPreparationSamples.length,
    motionLate2DBackingChanges: isMotionTrace
      ? late2DBackingChanges(trace.samples)
      : 0,
    motionSurfacePath: isMotionTrace
      ? uniqueMotionSurfacePath(trace.samples)
      : [],
    motionHandoffLatency: motionHandoffLatency(trace),
    motionStageSize: isMotionTrace
      ? valueRange(trace.samples, (sample) => sample.stageSize)
      : null,
    motionInspectorSize: isMotionTrace
      ? valueRange(trace.samples, (sample) => sample.inspectorSize)
      : null,
    tunnelUnreadyFrames: isTunnelTrace
      ? trace.samples.filter(
          (sample) => sample.tunnelOpacity >= 0.05 && !sample.tunnelCanvasReady
        ).length
      : 0,
    tunnelCrossfadeFrames: isTunnelTrace
      ? trace.samples.filter(
          (sample) =>
            sample.tunnelOpacity >= 0.05 && sample.tunnelOpacity <= 0.95
        ).length
      : 0,
    tunnelDoubleFadeFrames: isTunnelTrace
      ? trace.samples.filter((sample) => {
          const stageOpacity = tunnelStageOpacity(sample);
          return (
            sample.tunnelOpacity >= 0.05 &&
            sample.tunnelOpacity <= 0.95 &&
            stageOpacity >= 0.05 &&
            stageOpacity <= 0.95
          );
        }).length
      : 0,
    tunnelBlankFrames: isTunnelTrace
      ? trace.samples.filter(
          (sample) =>
            !sample.dissolveActive &&
            !sample.tunnelCanvasReady &&
            tunnelStageOpacity(sample) < 0.05
        ).length
      : 0,
    tunnelLateBackingChanges: isTunnelTrace
      ? lateTunnelBackingChanges(trace.samples)
      : 0,
    tunnelInspectorIdentityChanges: isTunnelTrace
      ? identityChanges(
          trace.samples.filter((sample) => sample.desktopInspectorExpected),
          (sample) => sample.inspectorIdentity
        )
      : 0,
    tunnelAnimatorIdentityChanges: isTunnelTrace
      ? identityChanges(trace.samples, (sample) => sample.animatorIdentity)
      : 0,
    tunnelDuplicateCanvasFrames: isTunnelTrace
      ? trace.samples.filter((sample) => sample.animatorCanvasCount !== 1)
          .length
      : 0,
    tunnelDuplicateSettingsFrames: isTunnelTrace
      ? trace.samples.filter((sample) => sample.activeArtSettingsCount > 1)
          .length
      : 0,
    tunnelSurfacePath: isTunnelTrace
      ? uniqueTunnelSurfacePath(trace.samples)
      : [],
    tunnelHandoffLatency: tunnelHandoffLatency(trace),
    tunnelStageSize: isTunnelTrace
      ? valueRange(trace.samples, (sample) => sample.stageSize)
      : null,
    tunnelDisplaySize: isTunnelTrace
      ? visibleTunnelRange(trace.samples, (sample) =>
          Math.min(sample.tunnelDisplayWidth, sample.tunnelDisplayHeight)
        )
      : null,
  };
}
