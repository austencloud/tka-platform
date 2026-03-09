<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { type LabanQuadrant, type SpaceQuality, getActionName } from "../domain/laban-actions";
  import { applyLabanEasing } from "../domain/laban-easing";

  interface Props {
    quadrant: LabanQuadrant;
    blueProp: PropState;
    redProp: PropState;
    gridMode: GridMode;
    letter: Letter | null;
    stepData: StepData | null;
    currentStep: number;
    isPlaying: boolean;
    word: string | null;
    currentSpace: SpaceQuality;
    weight: number;
    time: number;
    onWeightChange: (value: number) => void;
    onTimeChange: (value: number) => void;
  }

  const {
    quadrant,
    blueProp,
    redProp,
    gridMode,
    letter,
    stepData,
    currentStep,
    isPlaying,
    word,
    currentSpace,
    weight,
    time,
    onWeightChange,
    onTimeChange,
  }: Props = $props();

  const actionName = $derived(getActionName(quadrant, currentSpace));
  const displayName = $derived(actionName.charAt(0).toUpperCase() + actionName.slice(1));

  // --- Inline Laban curve preview (same SVG approach as EasingCurvePreview) ---
  const curveWidth = 120;
  const curveHeight = 40;
  const curvePadding = 4;
  const innerW = curveWidth - curvePadding * 2;
  const innerH = curveHeight - curvePadding * 2;
  const sampleCount = 48;

  const curvePath = $derived.by(() => {
    const parts: string[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const v = applyLabanEasing(t, weight, time);
      const x = curvePadding + t * innerW;
      const y = curvePadding + innerH - v * innerH;
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return parts.join(" ");
  });

  const referenceLine = (() => {
    const x1 = curvePadding;
    const y1 = curvePadding + innerH;
    const x2 = curvePadding + innerW;
    const y2 = curvePadding;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`;
  })();
</script>

<div class="laban-card" style:--accent={quadrant.color}>
  <div class="card-header">
    <span class="action-name">{displayName}</span>
  </div>

  <div class="canvas-container">
    <AnimatorCanvas
      {blueProp}
      {redProp}
      gridVisible={true}
      {gridMode}
      {letter}
      {stepData}
      {currentStep}
      {isPlaying}
      {word}
      backgroundAlpha={0}
      focused={false}
      disableContextMenu={true}
      hideTkaGlyph={false}
      hideStepNumbers={true}
    />
  </div>

  <div class="card-footer">
    <div class="card-info">
      <span class="card-label">{displayName}</span>
      <span class="card-description">{quadrant.weightLabel} · {quadrant.timeLabel}</span>
    </div>
    <svg
      width={curveWidth}
      height={curveHeight}
      viewBox="0 0 {curveWidth} {curveHeight}"
      role="img"
      aria-label="{displayName} easing curve"
      class="curve-preview"
    >
      <rect
        x="0"
        y="0"
        width={curveWidth}
        height={curveHeight}
        rx="6"
        ry="6"
        fill="rgba(0,0,0,0.2)"
      />
      <path
        d={referenceLine}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        stroke-width="1"
        stroke-dasharray="3,3"
      />
      <path
        d={curvePath}
        fill="none"
        stroke={quadrant.color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>

  <div class="param-sliders">
    <label class="param-row">
      <span class="param-label">Weight</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={weight}
        oninput={(e) => onWeightChange(Number(e.currentTarget.value))}
        class="param-slider"
        aria-label="{displayName} weight"
      />
      <span class="param-value">{weight.toFixed(2)}</span>
    </label>
    <label class="param-row">
      <span class="param-label">Time</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={time}
        oninput={(e) => onTimeChange(Number(e.currentTarget.value))}
        class="param-slider"
        aria-label="{displayName} time"
      />
      <span class="param-value">{time.toFixed(2)}</span>
    </label>
  </div>
</div>

<style>
  .laban-card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .laban-card:hover {
    border-color: var(--accent);
  }

  .card-header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .action-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--accent);
    line-height: 1.2;
  }

  .canvas-container {
    aspect-ratio: 1;
    width: 100%;
    position: relative;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .card-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--accent);
    line-height: 1.2;
  }

  .card-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    line-height: 1.3;
  }

  .curve-preview {
    display: block;
    flex-shrink: 0;
  }

  .param-sliders {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 12px 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .param-row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .param-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    min-width: 5ch;
    flex-shrink: 0;
  }

  .param-slider {
    flex: 1;
    height: 4px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .param-value {
    font-size: var(--font-size-compact, 12px);
    font-family: var(--font-mono, monospace);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    min-width: 4ch;
    text-align: right;
    flex-shrink: 0;
  }
</style>
