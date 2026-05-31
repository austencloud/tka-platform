<!--
  CardArrowFixGrid.svelte

  Thin adapter that renders the sequence with the established workspace StepGrid
  (the real grid that lays out the start position + numbered steps and respects
  prop-type overrides) and forwards a clicked cell — with the card's effective
  prop types injected — to the arrow editor. No hand-rolled grid: StepGrid owns
  the layout, StepCell owns the cell, this only maps a click to the StepData and
  pins the prop types so the edited override key matches the card-front bake key.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import { withEffectivePropTypes } from "../services/with-effective-prop-types";

  interface Props {
    sequence: SequenceData;
    bluePropType: PropType;
    redPropType: PropType;
    includeStartPosition?: boolean;
    onSelect: (step: StepData) => void;
  }

  let {
    sequence,
    bluePropType,
    redPropType,
    includeStartPosition = true,
    onSelect,
  }: Props = $props();

  function emit(step: StepData): void {
    onSelect(withEffectivePropTypes(step, bluePropType, redPropType));
  }

  // StepGrid uses 1-based step numbers (0 = start position).
  function handleStepClick(stepNumber: number): void {
    const step = sequence.steps?.[stepNumber - 1];
    if (step) emit(step);
  }

  function handleStartClick(): void {
    const start = sequence.startPosition;
    if (!start) return;
    emit({
      ...start,
      stepNumber: 0,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    } as unknown as StepData);
  }
</script>

<div class="fix-grid-host">
  <StepGrid
    steps={sequence.steps ?? []}
    startPosition={includeStartPosition ? sequence.startPosition ?? null : null}
    onStepClick={handleStepClick}
    onStartClick={handleStartClick}
    bluePropTypeOverride={bluePropType}
    redPropTypeOverride={redPropType}
  />
</div>

<style>
  .fix-grid-host {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
