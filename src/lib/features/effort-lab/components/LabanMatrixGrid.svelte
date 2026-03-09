<!--
  LabanMatrixGrid.svelte

  2x2 CSS grid displaying the four Laban Weight x Time quadrants with axis labels.
  Weight (vertical): Light / Strong
  Time (horizontal): Sustained / Sudden
-->
<script lang="ts">
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { SpaceQuality } from "../domain/laban-actions";
  import { LABAN_QUADRANTS } from "../domain/laban-actions";
  import LabanActionCard from "./LabanActionCard.svelte";

  interface Props {
    quadrantPropStates: Record<string, { blue: PropState; red: PropState }>;
    gridMode: GridMode;
    letter: Letter | null;
    stepData: StepData | null;
    currentStep: number;
    isPlaying: boolean;
    word: string | null;
    currentSpace: SpaceQuality;
    quadrantParams: Record<string, { weight: number; time: number }>;
    onQuadrantParamChange: (quadrantId: string, key: "weight" | "time", value: number) => void;
  }

  const {
    quadrantPropStates,
    gridMode,
    letter,
    stepData,
    currentStep,
    isPlaying,
    word,
    currentSpace,
    quadrantParams,
    onQuadrantParamChange,
  }: Props = $props();

  // Row 1: light-sustained (0), light-sudden (1)
  // Row 2: strong-sustained (2), strong-sudden (3)
  const topRow = LABAN_QUADRANTS.slice(0, 2);
  const bottomRow = LABAN_QUADRANTS.slice(2, 4);
</script>

<div class="laban-matrix">
  <!-- Header row: empty corner + column labels -->
  <div class="corner-cell"></div>
  <div class="column-header">Sustained</div>
  <div class="column-header">Sudden</div>

  <!-- Row 1: Light -->
  <div class="row-header">Light</div>
  {#each topRow as quadrant (quadrant.id)}
    {@const params = quadrantParams[quadrant.id] ?? { weight: 0.5, time: 0.5 }}
    {@const propState = quadrantPropStates[quadrant.id] ?? { blue: { centerPathAngle: 0, staffRotationAngle: 0 }, red: { centerPathAngle: 0, staffRotationAngle: 0 } }}
    <LabanActionCard
      {quadrant}
      blueProp={propState.blue}
      redProp={propState.red}
      {gridMode}
      {letter}
      {stepData}
      {currentStep}
      {isPlaying}
      {word}
      {currentSpace}
      weight={params.weight}
      time={params.time}
      onWeightChange={(v) => onQuadrantParamChange(quadrant.id, "weight", v)}
      onTimeChange={(v) => onQuadrantParamChange(quadrant.id, "time", v)}
    />
  {/each}

  <!-- Row 2: Strong -->
  <div class="row-header">Strong</div>
  {#each bottomRow as quadrant (quadrant.id)}
    {@const params = quadrantParams[quadrant.id] ?? { weight: 0.5, time: 0.5 }}
    {@const propState = quadrantPropStates[quadrant.id] ?? { blue: { centerPathAngle: 0, staffRotationAngle: 0 }, red: { centerPathAngle: 0, staffRotationAngle: 0 } }}
    <LabanActionCard
      {quadrant}
      blueProp={propState.blue}
      redProp={propState.red}
      {gridMode}
      {letter}
      {stepData}
      {currentStep}
      {isPlaying}
      {word}
      {currentSpace}
      weight={params.weight}
      time={params.time}
      onWeightChange={(v) => onQuadrantParamChange(quadrant.id, "weight", v)}
      onTimeChange={(v) => onQuadrantParamChange(quadrant.id, "time", v)}
    />
  {/each}
</div>

<style>
  .laban-matrix {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    grid-template-rows: auto 1fr 1fr;
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 16px;
  }

  .corner-cell {
    /* Empty top-left corner */
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding-bottom: 4px;
  }

  .row-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    padding-right: 4px;
  }
</style>
