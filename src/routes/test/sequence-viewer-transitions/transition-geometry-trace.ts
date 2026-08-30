export type TransitionTraceCommand = "2d" | "card" | "interrupt";

export type TransitionTracePhase =
  | "focus-2d"
  | "focus-card"
  | "return-split"
  | "interrupt-2d"
  | "interrupt-split"
  | "interrupt-card"
  | "interrupt-return";

export interface TransitionGeometrySample {
  time: number;
  phase: TransitionTracePhase;
  direction: "horizontal" | "vertical";
  focusedPane: string | null;
  selectedMode: "split" | "animation" | "card" | null;
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
  cardSettingsWidth: number;
  cardSettingsHeight: number;
  cardSettingsCenterY: number;
  cardSettingsOpacity: number;
  dissolveActive: boolean;
  animationOpacity: number;
  cardOpacity: number;
}

export interface TransitionGeometryTrace {
  command: TransitionTraceCommand;
  duration: number;
  samples: TransitionGeometrySample[];
  modeCommits: Array<{
    mode: "split" | "animation" | "card";
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

function uniqueValuePath<T extends string>(values: T[]): T[] {
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

export function summarizeTransitionGeometry(
  trace: TransitionGeometryTrace
): TransitionGeometrySummary {
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
  };
}
