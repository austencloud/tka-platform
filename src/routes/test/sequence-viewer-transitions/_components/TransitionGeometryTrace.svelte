<script lang="ts">
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    READABLE_PANE_SIZE,
    VISIBLE_PANE_OPACITY,
    MAX_MANDALA_RASTER_SCALE,
    summarizeTransitionGeometry,
    type TransitionEndpointUndershoot,
    type TransitionGeometrySample,
    type TransitionGeometryTrace,
    type TransitionTravelSummary,
    type TransitionValueRange,
  } from "../transition-geometry-trace";

  interface Props {
    trace: TransitionGeometryTrace;
  }

  let { trace }: Props = $props();

  const chartWidth = 760;
  const chartHeight = 168;
  const chartInset = 18;
  // ResizeObserver can publish one frame after the structural panel clock.
  // Two 60 Hz frames is the largest skew that still reads as one gesture.
  const maxCardClockSkew = 34;
  const isMotionTrace = $derived(trace.command.startsWith("3d"));
  const isTunnelTrace = $derived(trace.command.startsWith("tunnel"));
  const summary = $derived(summarizeTransitionGeometry(trace));
  const maximumSize = $derived(
    Math.max(
      READABLE_PANE_SIZE,
      ...trace.samples.map((sample) => sample.stageSize)
    )
  );
  const plotWidth = chartWidth - chartInset * 2;
  const plotHeight = chartHeight - chartInset * 2;

  function x(time: number): number {
    return chartInset + (time / Math.max(1, trace.duration)) * plotWidth;
  }

  function y(size: number): number {
    return chartHeight - chartInset - (size / maximumSize) * plotHeight;
  }

  function points(
    samples: TransitionGeometrySample[],
    value: (sample: TransitionGeometrySample) => number
  ): string {
    return samples
      .map((sample) => `${x(sample.time)},${y(value(sample))}`)
      .join(" ");
  }

  function formatSize(size: number | null): string {
    return size === null ? "n/a" : `${Math.round(size)} px`;
  }

  function formatCardBox(
    box: { width: number; height: number } | null
  ): string {
    return box
      ? `${Math.round(box.width)} × ${Math.round(box.height)} px`
      : "n/a";
  }

  function formatAspectRange(minimum: number | null, maximum: number | null) {
    return minimum === null || maximum === null
      ? "n/a"
      : `${minimum.toFixed(2)}–${maximum.toFixed(2)}`;
  }

  function formatUndershoot(
    value: TransitionEndpointUndershoot | null
  ): string {
    if (!value) return "n/a";
    return `${Math.round(value.start)} → ${Math.round(value.minimum)} → ${Math.round(value.end)} px · ${Math.round(value.undershoot)} px dip`;
  }

  function formatTravel(value: TransitionTravelSummary | null): string {
    if (!value) return "n/a";
    return `${Math.round(value.start)} → ${Math.round(value.end)} px · ${Math.round(value.backtrack)} px backtrack · ${Math.round(value.overshoot)} px overshoot`;
  }

  function formatRange(value: TransitionValueRange | null): string {
    if (!value) return "n/a";
    return `${Math.round(value.start)} → ${Math.round(value.end)} px · Δ${Math.round(value.variation)} px`;
  }

  function settingsReflow(
    width: TransitionValueRange | null,
    height: TransitionValueRange | null,
    centerY: TransitionValueRange | null
  ): boolean {
    return (
      (width?.variation ?? 0) > 1 ||
      (height?.variation ?? 0) > 1 ||
      (centerY?.variation ?? 0) > 1
    );
  }

  interface MotionTiming {
    start: number;
    end: number;
    onset: number;
    settle: number;
  }

  function motionTiming(
    phase: TransitionGeometrySample["phase"],
    value: (sample: TransitionGeometrySample) => number
  ): MotionTiming | null {
    const samples = trace.samples.filter(
      (sample) => sample.phase === phase && value(sample) > 0
    );
    if (samples.length < 2) return null;

    const start = value(samples[0]);
    const end = value(samples.at(-1)!);
    if (Math.abs(end - start) <= 0.75) return null;
    const timingTolerance = Math.max(0.75, Math.abs(end - start) * 0.02);

    const onset =
      samples.find(
        (sample) => Math.abs(value(sample) - start) > timingTolerance
      )?.time ?? samples[0].time;
    const settle =
      samples.find((sample, index) =>
        samples
          .slice(index)
          .every(
            (candidate) => Math.abs(value(candidate) - end) <= timingTolerance
          )
      )?.time ?? samples.at(-1)!.time;

    return { start, end, onset, settle };
  }

  function formatMotionTiming(value: MotionTiming | null): string {
    if (!value) return "n/a";
    return `${Math.round(value.start)} → ${Math.round(value.end)} px · ${Math.round(value.onset)}–${Math.round(value.settle)} ms`;
  }

  const cardFocusWidthMotion = $derived(
    motionTiming("focus-card", (sample) => sample.cardContentWidth)
  );
  const cardFocusVerticalMotion = $derived(
    motionTiming("focus-card", (sample) => sample.cardContentCenterY)
  );
  const cardFocusOnsetSkew = $derived(
    cardFocusWidthMotion && cardFocusVerticalMotion
      ? Math.abs(cardFocusWidthMotion.onset - cardFocusVerticalMotion.onset)
      : null
  );
  const cardFocusSettleSkew = $derived(
    cardFocusWidthMotion && cardFocusVerticalMotion
      ? Math.abs(cardFocusWidthMotion.settle - cardFocusVerticalMotion.settle)
      : null
  );
  const cardGeometryVisible = $derived(summary.dissolveFrames === 0);
  const cardReturnWidthMotion = $derived(
    motionTiming("return-split", (sample) => sample.cardContentWidth)
  );
  const cardReturnVerticalMotion = $derived(
    motionTiming("return-split", (sample) => sample.cardContentCenterY)
  );
  const cardReturnOnsetSkew = $derived(
    cardReturnWidthMotion && cardReturnVerticalMotion
      ? Math.abs(cardReturnWidthMotion.onset - cardReturnVerticalMotion.onset)
      : null
  );
  const cardReturnSettleSkew = $derived(
    cardReturnWidthMotion && cardReturnVerticalMotion
      ? Math.abs(cardReturnWidthMotion.settle - cardReturnVerticalMotion.settle)
      : null
  );

  const modeCommitSummary = $derived(
    trace.modeCommits
      .map(
        (commit) =>
          `${commit.mode} ${Math.max(0, Math.round(commit.latency))} ms`
      )
      .join(" · ")
  );

  const slowModeCommit = $derived(
    trace.modeCommits.some((commit) => commit.latency > DURATION.instant)
  );

  const tinyCardSamples = $derived(
    trace.samples.filter(
      (sample) =>
        sample.cardOpacity >= VISIBLE_PANE_OPACITY &&
        sample.cardContentWidth < READABLE_PANE_SIZE
    )
  );
  const firstTinyCardSample = $derived(tinyCardSamples[0] ?? null);
  const firstMagnifiedMandalaSample = $derived(
    trace.samples.find(
      (sample) =>
        sample.phase === "return-split" &&
        sample.mandalaRasterScale > MAX_MANDALA_RASTER_SCALE
    ) ?? null
  );
  const returnPanelMinimumSample = $derived.by(() => {
    const returnSamples = trace.samples.filter(
      (sample) => sample.phase === "return-split" && sample.cardPanelWidth > 0
    );
    return (
      returnSamples.reduce<TransitionGeometrySample | null>(
        (minimum, sample) =>
          !minimum || sample.cardPanelWidth < minimum.cardPanelWidth
            ? sample
            : minimum,
        null
      ) ?? null
    );
  });
  const returnMotionOnsets = $derived.by(() => {
    const returnSamples = trace.samples.filter(
      (sample) => sample.phase === "return-split"
    );
    const first = returnSamples[0];
    if (!first) return null;
    const inner = returnSamples.find(
      (sample) => sample.animationFlexGrow > first.animationFlexGrow + 0.01
    );
    const outer = returnSamples.find(
      (sample) => sample.inspectorSize < first.inspectorSize - 1
    );
    return {
      phaseStart: first.time,
      innerStart: inner?.time ?? null,
      outerStart: outer?.time ?? null,
    };
  });
</script>

<section class="geometry-trace" aria-labelledby="geometry-trace-title">
  <header>
    <div>
      <span>Measured geometry</span>
      <h3 id="geometry-trace-title">
        {isMotionTrace
          ? "2D and 3D through the last replay"
          : isTunnelTrace
            ? "One canvas becoming Tunnel through the last replay"
            : "Pane size through the last replay"}
      </h3>
    </div>
    <div class="trace-legend" aria-label="Geometry trace legend">
      <span class="animation"
        >{isMotionTrace
          ? "2D opacity"
          : isTunnelTrace
            ? "2D base"
            : "Animation"}</span
      >
      <span class="card"
        >{isMotionTrace
          ? "3D opacity"
          : isTunnelTrace
            ? "Tunnel layer blend"
            : "Card visual"}</span
      >
      <span class="stage">Stage</span>
    </div>
  </header>

  <div class="trace-summary">
    {#if isTunnelTrace}
      <span data-problem={summary.tunnelUnreadyFrames > 0}
        >Unready Tunnel frames: {summary.tunnelUnreadyFrames}</span
      >
      <span data-dissolve={summary.tunnelCrossfadeFrames > 0}
        >Layer-bloom frames: {summary.tunnelCrossfadeFrames}</span
      >
      <span data-problem={summary.tunnelDoubleFadeFrames > 0}
        >Double-fade frames: {summary.tunnelDoubleFadeFrames}</span
      >
      <span data-problem={summary.tunnelBlankFrames > 0}
        >Blank frames: {summary.tunnelBlankFrames}</span
      >
      <span data-problem={summary.tunnelLateBackingChanges > 0}
        >Late Tunnel backing changes: {summary.tunnelLateBackingChanges}</span
      >
      <span data-problem={summary.tunnelAnimatorIdentityChanges > 0}
        >Animator remounts: {summary.tunnelAnimatorIdentityChanges}</span
      >
      <span data-problem={summary.tunnelInspectorIdentityChanges > 0}
        >Inspector remounts: {summary.tunnelInspectorIdentityChanges}</span
      >
      <span data-problem={summary.tunnelDuplicateCanvasFrames > 0}
        >Non-singleton canvas frames: {summary.tunnelDuplicateCanvasFrames}</span
      >
      <span data-problem={summary.tunnelDuplicateSettingsFrames > 0}
        >Duplicate active settings frames: {summary.tunnelDuplicateSettingsFrames}</span
      >
      <span
        >Ready-frame handoff: {summary.tunnelHandoffLatency === null
          ? "n/a"
          : `${Math.round(summary.tunnelHandoffLatency)} ms`}</span
      >
      <span>Surface path: {summary.tunnelSurfacePath.join(" → ") || "n/a"}</span
      >
      <span>Stage allocation: {formatRange(summary.tunnelStageSize)}</span>
      <span>Tunnel display: {formatRange(summary.tunnelDisplaySize)}</span>
      <span data-dissolve={summary.dissolveFrames > 0}
        >Workspace dissolve frames: {summary.dissolveFrames}</span
      >
      <span>Mode path: {summary.modePath.join(" → ") || "n/a"}</span>
      <span data-problem={slowModeCommit}
        >Mode commit: {modeCommitSummary || "n/a"}</span
      >
      <span>Outer axis: {summary.outerDirectionPath.join(" → ") || "n/a"}</span>
    {:else if isMotionTrace}
      <span data-problem={summary.motionBlankFrames > 0}
        >Blank motion frames: {summary.motionBlankFrames}</span
      >
      <span data-problem={summary.motionUnready3DFrames > 0}
        >Unprotected 3D frames: {summary.motionUnready3DFrames}</span
      >
      <span
        data-problem={summary.motionPreparationFrames > 0 &&
          summary.motionCurtainFrames < summary.motionPreparationFrames}
        >Protected preparation frames: {summary.motionCurtainFrames} / {summary.motionPreparationFrames}</span
      >
      <span data-problem={summary.motionMisidentified3DFrames > 0}
        >Misidentified 3D frames: {summary.motionMisidentified3DFrames}</span
      >
      <span data-problem={summary.motionPreparationProgressRegressions > 0}
        >Progress regressions: {summary.motionPreparationProgressRegressions}</span
      >
      <span
        >Preparation phases: {summary.motionPreparationLabels.join(" → ") ||
          "n/a"}</span
      >
      <span data-dissolve={summary.motionCrossfadeFrames > 0}
        >Crossfade frames: {summary.motionCrossfadeFrames}</span
      >
      <span
        >Sharp 2D exit frames: {summary.motionPreparationGeometryHeldFrames}</span
      >
      <span data-problem={summary.motionMagnifiedPreparationFrames > 0}
        >Placeholder raster growth: {summary.motionPreparationRasterGrowthMaximum ===
        null
          ? "n/a"
          : `${summary.motionPreparationRasterGrowthMaximum.toFixed(2)}×`} · peak
        scale {summary.motionPreparationRasterScaleMaximum === null
          ? "n/a"
          : `${summary.motionPreparationRasterScaleMaximum.toFixed(2)}×`}</span
      >
      <span data-problem={summary.motionMagnifiedPreparationFrames > 0}
        >Magnified placeholder frames: {summary.motionMagnifiedPreparationFrames}</span
      >
      <span data-problem={summary.motionLate2DBackingChanges > 0}
        >Late 2D backing changes: {summary.motionLate2DBackingChanges}</span
      >
      <span
        >Ready-frame handoff: {summary.motionHandoffLatency === null
          ? "n/a"
          : `${Math.round(summary.motionHandoffLatency)} ms`}</span
      >
      <span>Surface path: {summary.motionSurfacePath.join(" → ") || "n/a"}</span
      >
      <span>Stage allocation: {formatRange(summary.motionStageSize)}</span>
      <span
        >Inspector allocation: {formatRange(summary.motionInspectorSize)}</span
      >
      <span data-dissolve={summary.dissolveFrames > 0}
        >Workspace dissolve frames: {summary.dissolveFrames}</span
      >
      <span>Mode path: {summary.modePath.join(" → ") || "n/a"}</span>
      <span data-problem={slowModeCommit}
        >Mode commit: {modeCommitSummary || "n/a"}</span
      >
      <span>Outer axis: {summary.outerDirectionPath.join(" → ") || "n/a"}</span>
    {:else}
      <span
        data-problem={summary.animationExitMinimum !== null &&
          summary.animationExitMinimum < READABLE_PANE_SIZE}
        >Animation exit: {formatSize(summary.animationExitMinimum)}</span
      >
      <span
        data-problem={summary.animationEntryMinimum !== null &&
          summary.animationEntryMinimum < READABLE_PANE_SIZE}
        >Animation entry: {formatSize(summary.animationEntryMinimum)}</span
      >
      <span
        data-problem={summary.cardExitMinimum !== null &&
          summary.cardExitMinimum < READABLE_PANE_SIZE}
        >Card exit: {formatSize(summary.cardExitMinimum)}</span
      >
      <span
        data-problem={summary.cardEntryMinimum !== null &&
          summary.cardEntryMinimum < READABLE_PANE_SIZE}
        >Card entry: {formatSize(summary.cardEntryMinimum)}</span
      >
      <span data-problem={summary.tinyCardFrames > 0}
        >Tiny Card frames: {summary.tinyCardFrames}</span
      >
      <span data-problem={summary.tinyAnimationFrames > 0}
        >Tiny Animation frames: {summary.tinyAnimationFrames}</span
      >
      <span data-problem={summary.magnifiedMandalaReturnFrames > 0}
        >Mandala return scale: {summary.mandalaReturnRasterScaleMaximum === null
          ? "n/a"
          : `${summary.mandalaReturnRasterScaleMaximum.toFixed(2)}×`}</span
      >
      <span data-problem={summary.magnifiedMandalaReturnFrames > 0}
        >Magnified Mandala frames: {summary.magnifiedMandalaReturnFrames}</span
      >
      <span data-dissolve={summary.dissolveFrames > 0}
        >Dissolve frames: {summary.dissolveFrames}</span
      >
      <span data-problem={summary.squashedCardFrames > 0}
        >Card minimum box: {formatCardBox(summary.cardBoxMinimum)}</span
      >
      <span data-problem={summary.squashedCardFrames > 0}
        >Card aspect: {formatAspectRange(
          summary.cardAspectMinimum,
          summary.cardAspectMaximum
        )}</span
      >
      <span data-problem={summary.squashedCardFrames > 0}
        >Squashed Card frames: {summary.squashedCardFrames}</span
      >
      <span data-dissolve={summary.dissolveCoveredCardFrames > 0}
        >Dissolve-covered Card reflow: {summary.dissolveCoveredCardFrames}</span
      >
      <span data-problem={summary.transformedCardCellFrames > 0}
        >Transformed Card cell frames: {summary.transformedCardCellFrames} · max
        {summary.maximumTransformedCardCells} cells</span
      >
      <span>Mode path: {summary.modePath.join(" → ") || "n/a"}</span>
      <span data-problem={slowModeCommit}
        >Mode commit: {modeCommitSummary || "n/a"}</span
      >
      <span>Panel axis: {summary.panelDirectionPath.join(" → ") || "n/a"}</span>
      <span>Outer axis: {summary.outerDirectionPath.join(" → ") || "n/a"}</span>
      <span>Card layout: {summary.cardLayoutPath.join(" → ") || "n/a"}</span>
      <span
        >Layout lease: {summary.cardLayoutLockPath.join(" → ") || "n/a"}</span
      >
      <span
        data-problem={cardGeometryVisible &&
          ((cardFocusOnsetSkew ?? 0) > maxCardClockSkew ||
            (cardFocusSettleSkew ?? 0) > maxCardClockSkew)}
        >Card focus width: {formatMotionTiming(cardFocusWidthMotion)}</span
      >
      <span
        data-problem={cardGeometryVisible &&
          ((cardFocusOnsetSkew ?? 0) > maxCardClockSkew ||
            (cardFocusSettleSkew ?? 0) > maxCardClockSkew)}
        >Card focus rise: {formatMotionTiming(cardFocusVerticalMotion)} · onset skew
        {cardFocusOnsetSkew === null
          ? "n/a"
          : `${Math.round(cardFocusOnsetSkew)} ms`} · settle skew
        {cardFocusSettleSkew === null
          ? "n/a"
          : `${Math.round(cardFocusSettleSkew)} ms`}</span
      >
      <span
        data-problem={cardGeometryVisible &&
          ((cardReturnOnsetSkew ?? 0) > maxCardClockSkew ||
            (cardReturnSettleSkew ?? 0) > maxCardClockSkew)}
        >Card return width: {formatMotionTiming(cardReturnWidthMotion)}</span
      >
      <span
        data-problem={cardGeometryVisible &&
          ((cardReturnOnsetSkew ?? 0) > maxCardClockSkew ||
            (cardReturnSettleSkew ?? 0) > maxCardClockSkew)}
        >Card return fall: {formatMotionTiming(cardReturnVerticalMotion)} · onset
        skew
        {cardReturnOnsetSkew === null
          ? "n/a"
          : `${Math.round(cardReturnOnsetSkew)} ms`} · settle skew
        {cardReturnSettleSkew === null
          ? "n/a"
          : `${Math.round(cardReturnSettleSkew)} ms`}</span
      >
      <span data-problem={(summary.cardReturnPanelWidth?.undershoot ?? 0) > 1}
        >Return panel: {formatUndershoot(summary.cardReturnPanelWidth)}</span
      >
      <span data-problem={(summary.cardReturnPanelHeight?.undershoot ?? 0) > 1}
        >Return panel height: {formatUndershoot(
          summary.cardReturnPanelHeight
        )}</span
      >
      <span data-problem={(summary.cardReturnRootWidth?.undershoot ?? 0) > 1}
        >Return root width: {formatUndershoot(
          summary.cardReturnRootWidth
        )}</span
      >
      <span data-problem={(summary.cardReturnRootHeight?.undershoot ?? 0) > 1}
        >Return root height: {formatUndershoot(
          summary.cardReturnRootHeight
        )}</span
      >
      <span data-problem={(summary.cardReturnVisualWidth?.undershoot ?? 0) > 1}
        >Return visual width: {formatUndershoot(
          summary.cardReturnVisualWidth
        )}</span
      >
      <span data-problem={(summary.cardReturnVisualHeight?.undershoot ?? 0) > 1}
        >Return visual height: {formatUndershoot(
          summary.cardReturnVisualHeight
        )}</span
      >
      <span
        data-problem={(summary.cardReturnTravel?.backtrack ?? 0) > 1 ||
          (summary.cardReturnTravel?.overshoot ?? 0) > 1}
        >Return travel: {formatTravel(summary.cardReturnTravel)}</span
      >
      <span
        data-problem={settingsReflow(
          summary.cardSettingsFocusWidth,
          summary.cardSettingsFocusHeight,
          summary.cardSettingsFocusCenterY
        )}
        >Settings enter: width {formatRange(summary.cardSettingsFocusWidth)} · height
        {formatRange(summary.cardSettingsFocusHeight)} · center Y
        {formatRange(summary.cardSettingsFocusCenterY)}</span
      >
      <span
        data-problem={settingsReflow(
          summary.cardSettingsReturnWidth,
          summary.cardSettingsReturnHeight,
          summary.cardSettingsReturnCenterY
        )}
        >Settings leave: width {formatRange(summary.cardSettingsReturnWidth)} · height
        {formatRange(summary.cardSettingsReturnHeight)} · center Y
        {formatRange(summary.cardSettingsReturnCenterY)}</span
      >
      {#if returnPanelMinimumSample}
        <span data-problem={(summary.cardReturnPanelWidth?.undershoot ?? 0) > 1}
          >Minimum at {Math.round(returnPanelMinimumSample.time)} ms · stage
          {Math.round(returnPanelMinimumSample.stageSize)} px · pane flex
          {returnPanelMinimumSample.animationFlexGrow.toFixed(2)} / {returnPanelMinimumSample.cardFlexGrow.toFixed(
            2
          )} · inspector {Math.round(returnPanelMinimumSample.inspectorSize)} px</span
        >
      {/if}
      {#if returnMotionOnsets}
        <span
          >Return onset: {Math.round(returnMotionOnsets.phaseStart)} ms · inner
          {returnMotionOnsets.innerStart === null
            ? "n/a"
            : `${Math.round(returnMotionOnsets.innerStart)} ms`} · outer
          {returnMotionOnsets.outerStart === null
            ? "n/a"
            : `${Math.round(returnMotionOnsets.outerStart)} ms`}</span
        >
      {/if}
    {/if}
  </div>

  {#if firstTinyCardSample}
    <p class="problem-detail">
      First tiny card at {Math.round(firstTinyCardSample.time)} ms ·
      {firstTinyCardSample.phase} · panel
      {Math.round(firstTinyCardSample.cardPanelWidth)} ×
      {Math.round(firstTinyCardSample.cardPanelHeight)} · root
      {Math.round(firstTinyCardSample.cardRootWidth)} ×
      {Math.round(firstTinyCardSample.cardRootHeight)} · visual
      {Math.round(firstTinyCardSample.cardContentWidth)} ×
      {Math.round(firstTinyCardSample.cardContentHeight)} · opacity
      {firstTinyCardSample.cardOpacity.toFixed(2)} · focus
      {firstTinyCardSample.focusedPane ?? "split"} · flex
      {firstTinyCardSample.animationFlexGrow.toFixed(2)} /
      {firstTinyCardSample.cardFlexGrow.toFixed(2)} · stage
      {Math.round(firstTinyCardSample.stageSize)}
      ({firstTinyCardSample.stageFlexGrow.toFixed(2)}) · inspector
      {Math.round(firstTinyCardSample.inspectorSize)}
      ({firstTinyCardSample.inspectorFlexGrow.toFixed(2)}) · outer
      {firstTinyCardSample.outerDirection} · hidden/readable
      {String(firstTinyCardSample.cardHidden)} /
      {String(firstTinyCardSample.cardReadable)}
    </p>
  {/if}

  {#if firstMagnifiedMandalaSample}
    <p class="problem-detail">
      First magnified mandala at {Math.round(firstMagnifiedMandalaSample.time)}
      ms · backing {Math.round(firstMagnifiedMandalaSample.mandalaBackingSize)}
      px · display {Math.round(firstMagnifiedMandalaSample.mandalaDisplaySize)}
      px · {firstMagnifiedMandalaSample.mandalaRasterScale.toFixed(2)}×
    </p>
  {/if}

  <svg
    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
    role="img"
    aria-label={isMotionTrace
      ? `2D and 3D opacity during the ${trace.command} replay. ${summary.motionBlankFrames} blank frames were sampled.`
      : isTunnelTrace
        ? `The persistent 2D base and Tunnel layer blend during the ${trace.command} replay. ${summary.tunnelAnimatorIdentityChanges} Animator remounts were sampled.`
        : `Pane sizes during the ${trace.command} replay. The Card pane was visibly smaller than ${READABLE_PANE_SIZE} pixels for ${summary.tinyCardFrames} sampled frames.`}
  >
    {#if !isMotionTrace && !isTunnelTrace}
      <line
        class="readable-threshold"
        x1={chartInset}
        x2={chartWidth - chartInset}
        y1={y(READABLE_PANE_SIZE)}
        y2={y(READABLE_PANE_SIZE)}
      />
      <text x={chartInset + 4} y={y(READABLE_PANE_SIZE) - 5}
        >{READABLE_PANE_SIZE}px readable floor</text
      >
    {/if}
    <polyline
      class="stage-line"
      points={points(trace.samples, (sample) => sample.stageSize)}
    />
    {#if isTunnelTrace}
      <polyline
        class="animation-line"
        points={points(trace.samples, () => maximumSize)}
      />
      <polyline
        class="card-line"
        points={points(
          trace.samples,
          (sample) => sample.tunnelOpacity * maximumSize
        )}
      />
    {:else if isMotionTrace}
      <polyline
        class="animation-line"
        points={points(
          trace.samples,
          (sample) => sample.motion2DOpacity * maximumSize
        )}
      />
      <polyline
        class="card-line"
        points={points(
          trace.samples,
          (sample) => sample.motion3DOpacity * maximumSize
        )}
      />
    {:else}
      <polyline
        class="animation-line"
        points={points(trace.samples, (sample) => sample.animationSize)}
      />
      <polyline
        class="card-line"
        points={points(trace.samples, (sample) => sample.cardContentWidth)}
      />
      <polyline
        class="card-height-line"
        points={points(trace.samples, (sample) => sample.cardContentHeight)}
      />
      {#each tinyCardSamples as sample}
        <circle
          class="problem-point"
          cx={x(sample.time)}
          cy={y(sample.cardContentWidth)}
          r="3"
        />
      {/each}
    {/if}
  </svg>
</section>

<style>
  .geometry-trace {
    margin-top: 14px;
    padding: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  header,
  .trace-legend,
  .trace-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  header {
    justify-content: space-between;
    gap: 12px;
  }

  header span {
    color: var(--theme-accent, #a78bfa);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3 {
    margin: 3px 0 0;
    font-size: var(--font-size-lg, 18px);
  }

  .trace-legend,
  .trace-summary {
    gap: 10px;
  }

  .trace-legend span,
  .trace-summary span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.66));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .trace-legend span::before {
    display: inline-block;
    width: 18px;
    height: 2px;
    margin-right: 6px;
    vertical-align: middle;
    background: currentColor;
    content: "";
  }

  .trace-legend .animation {
    color: var(--prop-blue, #4aa3ff);
  }

  .trace-legend .card {
    color: var(--theme-accent, #a78bfa);
  }

  .trace-legend .stage {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.66));
  }

  .trace-summary {
    margin-top: 12px;
  }

  .trace-summary span[data-problem="true"] {
    color: var(--semantic-warning, #fbbf24);
  }

  .trace-summary span[data-dissolve="true"] {
    color: var(--semantic-success, #6ee7b7);
  }

  .problem-detail {
    margin: 8px 0 0;
    color: var(--semantic-warning, #fbbf24);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    margin-top: 8px;
    overflow: visible;
  }

  polyline,
  line {
    vector-effect: non-scaling-stroke;
  }

  polyline {
    fill: none;
    stroke-width: 2;
  }

  .stage-line {
    stroke: var(--theme-text-dim, rgba(255, 255, 255, 0.52));
  }

  .animation-line {
    stroke: var(--prop-blue, #4aa3ff);
  }

  .card-line {
    stroke: var(--theme-accent, #a78bfa);
  }

  .card-height-line {
    stroke: var(--semantic-success, #6ee7b7);
    stroke-dasharray: 5 4;
  }

  .readable-threshold {
    stroke: var(--semantic-warning, #fbbf24);
    stroke-dasharray: 4 4;
    stroke-width: 1;
  }

  text {
    fill: var(--semantic-warning, #fbbf24);
    font-size: var(--font-size-compact, 12px);
  }

  .problem-point {
    fill: var(--semantic-warning, #fbbf24);
  }

  @media (max-width: 720px) {
    header {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
