<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { EffortQualityDescriptor } from "../domain/effort-qualities";
  import EasingCurvePreview from "./EasingCurvePreview.svelte";

  interface Props {
    descriptor: EffortQualityDescriptor;
    blueProp: PropState;
    redProp: PropState;
    gridMode: GridMode;
    letter: Letter | null;
    stepData: StepData | null;
    currentStep: number;
    isPlaying: boolean;
    word: string | null;
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
  }: Props = $props();
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
      <span class="card-label">{descriptor.label}</span>
      <span class="card-description">{descriptor.description}</span>
    </div>
    <EasingCurvePreview quality={descriptor.id} color={descriptor.color} />
  </div>
</div>

<style>
  .effort-card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .effort-card:hover {
    border-color: var(--accent);
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
</style>
