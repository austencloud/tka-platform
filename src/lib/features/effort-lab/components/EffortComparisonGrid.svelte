<script lang="ts">
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { EffortId, EffortParams } from "../domain/effort-types";
  import { EFFORTS } from "../domain/effort-types";
  import EffortCanvasCard from "./EffortCanvasCard.svelte";

  interface Props {
    propStates: Record<EffortId, { blue: PropState; red: PropState }>;
    gridMode: GridMode;
    letter: Letter | null;
    stepData: StepData | null;
    currentStep: number;
    isPlaying: boolean;
    word: string | null;
    qualityParams: Record<EffortId, EffortParams>;
    onQualityParamsChange: (quality: EffortId, params: EffortParams) => void;
  }

  const {
    propStates,
    gridMode,
    letter,
    stepData,
    currentStep,
    isPlaying,
    word,
    qualityParams,
    onQualityParamsChange,
  }: Props = $props();
</script>

<div class="effort-comparison-grid themed-scrollbar">
  {#each EFFORTS as descriptor (descriptor.id)}
    <EffortCanvasCard
      {descriptor}
      blueProp={propStates[descriptor.id].blue}
      redProp={propStates[descriptor.id].red}
      {gridMode}
      {letter}
      {stepData}
      {currentStep}
      {isPlaying}
      {word}
      params={qualityParams[descriptor.id]}
      onParamsChange={(p) => onQualityParamsChange(descriptor.id, p)}
    />
  {/each}
</div>

<style>
  .effort-comparison-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-md, 16px);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--spacing-md, 16px);
  }

  @media (max-width: 900px) {
    .effort-comparison-grid {
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }
  }
</style>
