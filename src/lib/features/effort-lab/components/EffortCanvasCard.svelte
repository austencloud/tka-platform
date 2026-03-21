<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { EffortDescriptor, EffortParams } from "../domain/effort-types";
  import EasingCurvePreview from "./EasingCurvePreview.svelte";

  interface Props {
    descriptor: EffortDescriptor;
    blueProp: PropState;
    redProp: PropState;
    gridMode: GridMode;
    letter: Letter | null;
    stepData: StepData | null;
    currentStep: number;
    isPlaying: boolean;
    word: string | null;
    params: EffortParams;
    onParamsChange: (params: EffortParams) => void;
  }

  const {
    descriptor,
    blueProp,
    redProp,
    gridMode,
    letter,
    stepData,
    currentStep,
    isPlaying,
    word,
    params,
    onParamsChange,
  }: Props = $props();

  function handleParamChange(key: string, value: number) {
    onParamsChange({ ...params, [key]: value });
  }
</script>

<div class="effort-card" style:--accent={descriptor.color}>
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
      backgroundAlpha={0}
      focused={false}
      hideTkaGlyph={false}
      hideStepNumbers={true}
      hideProgressBar={true}
      fillContainer={true}
      fireConfig={{ disableFrameCache: true }}
    />

    <!-- Overlay badge visible on all sizes, essential on mobile where footer is hidden -->
    <span class="effort-badge">{descriptor.label}</span>
  </div>

  <div class="card-footer">
    <div class="card-info">
      <span class="card-label">{descriptor.label}</span>
      <span class="card-subtitle">{descriptor.subtitle}</span>
    </div>
    <EasingCurvePreview effortId={descriptor.id} color={descriptor.color} {params} />
  </div>

  {#if descriptor.params.length > 0}
    <div class="param-sliders">
      {#each descriptor.params as paramDef (paramDef.key)}
        <label class="param-row">
          <span class="param-label">{paramDef.label}</span>
          <input
            type="range"
            min={paramDef.min}
            max={paramDef.max}
            step={paramDef.step}
            value={params[paramDef.key] ?? paramDef.defaultValue}
            oninput={(e) => handleParamChange(paramDef.key, Number(e.currentTarget.value))}
            class="param-slider"
            aria-label="{descriptor.label} {paramDef.label}"
          />
          <span class="param-value">{(params[paramDef.key] ?? paramDef.defaultValue).toFixed(paramDef.step < 1 ? 1 : 0)}</span>
        </label>
      {/each}
    </div>
  {/if}
</div>

<style>
  .effort-card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--accent, var(--theme-stroke, rgba(255, 255, 255, 0.1)));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    min-height: 0;
  }

  .canvas-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    position: relative;
  }

  .effort-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: #fff;
    background: var(--accent, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
    pointer-events: none;
    opacity: 0.85;
    z-index: 1;
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

  .card-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-style: italic;
    line-height: 1.2;
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
    min-width: 3ch;
    text-align: right;
    flex-shrink: 0;
  }

  /* Mobile: canvas-only cards with overlay badge, no footer or sliders */
  @media (max-width: 600px) {
    .effort-card {
      border-radius: 8px;
    }

    .card-footer {
      display: none;
    }

    .param-sliders {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .effort-card {
      transition: none;
    }
  }
</style>
