<!--
  CardArrowFixGrid.svelte

  Live, clickable grid of a sequence's pictographs for in-card arrow fixing.
  Wraps the prop-aware StepCell (the create workspace's cell primitive); clicking
  a cell emits the step with the card's effective prop types injected, so the
  arrow editor keys its override the same way the card-front bake does.

  StepGrid.svelte is intentionally not reused here: it is coupled to create-module
  selection state. StepCell is the prop-driven primitive underneath it.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import StepCell from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepCell.svelte";
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

  // Start position (step 0) first when present, then non-blank steps. Mirrors
  // StepEditorCoordinator's proven step-0 construction from StartPositionData.
  const cells = $derived.by<StepData[]>(() => {
    const out: StepData[] = [];
    const start = sequence.startPosition;
    if (includeStartPosition && start) {
      out.push({
        ...start,
        stepNumber: 0,
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      } as unknown as StepData);
    }
    for (const s of sequence.steps ?? []) {
      if (s && !s.isBlank) out.push(s);
    }
    return out;
  });

  function handleSelect(step: StepData): void {
    onSelect(withEffectivePropTypes(step, bluePropType, redPropType));
  }
</script>

<div class="fix-grid-scroll">
  <div class="fix-grid" role="group" aria-label="Pictographs — click one to fix its arrows">
    {#each cells as step, i (step.id ?? i)}
      <div class="fix-cell">
        <StepCell
          {step}
          index={i}
          bluePropTypeOverride={bluePropType}
          redPropTypeOverride={redPropType}
          onClick={() => handleSelect(step)}
        />
      </div>
    {/each}
  </div>
</div>

<style>
  /* Fill the central space both cards used; center a tidy block of large
     cells (auto-fit collapses empty tracks so a short sequence doesn't pack
     into a small top-left cluster). */
  .fix-grid-scroll {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .fix-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 260px));
    gap: 20px;
    justify-content: center;
    align-content: center;
    width: 100%;
    max-width: 1100px;
  }
  .fix-cell {
    aspect-ratio: 1 / 1;
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
  }
  .fix-cell:hover {
    border-color: var(--theme-accent, #58a6ff);
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
    transform: translateY(-2px);
  }
  .fix-cell:focus-visible {
    outline: 2px solid var(--theme-accent, #58a6ff);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .fix-cell { transition: none; }
  }
</style>
