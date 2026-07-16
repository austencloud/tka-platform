<script lang="ts">
  /**
   * Designations List
   *
   * Displays the list of confirmed designations (whole, section, beat pair)
   * and special type indicators (freeform, modular, axis-alternating).
   */
  import type { LOOPDesignation } from "../../../domain/models/label-models";
  import type { SectionDesignation } from "../../../domain/models/section-models";
  import type { StepPairRelationship } from "../../../domain/models/steppair-models";
  import type { AxisAlternatingPattern } from "../../../services/ILOOPDetector";
  import DesignationItem from "./DesignationItem.svelte";
  import { formatSectionSteps, formatDesignation } from "../../../services/label-formatter";

  interface Props {
    wholeDesignations: LOOPDesignation[];
    sectionDesignations: SectionDesignation[];
    stepPairDesignations: StepPairRelationship[];
    isFreeform: boolean;
    isModular: boolean;
    isAxisAlternating: boolean;
    axisAlternatingPattern: AxisAlternatingPattern | null;
    onRemoveWholeDesignation: (index: number) => void;
    onRemoveSectionDesignation: (index: number) => void;
    onRemoveStepPairDesignation: (index: number) => void;
  }

  let {
    wholeDesignations,
    sectionDesignations,
    stepPairDesignations,
    isFreeform,
    isModular,
    isAxisAlternating,
    axisAlternatingPattern,
    onRemoveWholeDesignation,
    onRemoveSectionDesignation,
    onRemoveStepPairDesignation,
  }: Props = $props();

  const totalCount = $derived(
    wholeDesignations.length +
      sectionDesignations.length +
      stepPairDesignations.length
  );

  function formatBeatPair(bp: StepPairRelationship): string {
    const transformation = bp.confirmedTransformation || "Unknown";
    return `Step ${bp.keyStep} ↔ ${bp.correspondingStep}: ${transformation}`;
  }

  function formatSection(s: SectionDesignation): string {
    const steps = formatSectionSteps(s.steps);
    const label = formatDesignation(s);
    return `${steps}: ${label}`;
  }
</script>

<div class="designations-list">
  {#if totalCount === 0 && !isFreeform}
    <div class="empty-state">
      <span class="empty-text">No designations yet</span>
      <span class="empty-hint"
        >1. Select components below → 2. Click "+ Add to designations"</span
      >
    </div>
  {:else}
    <!-- Whole sequence designations -->
    {#each wholeDesignations as d, i}
      <DesignationItem
        type="whole"
        badge="W"
        label={formatDesignation(d)}
        onRemove={() => onRemoveWholeDesignation(i)}
      />
    {/each}

    <!-- Section designations -->
    {#each sectionDesignations as s, i}
      <DesignationItem
        type="section"
        badge="S"
        label={formatSection(s)}
        onRemove={() => onRemoveSectionDesignation(i)}
      />
    {/each}

    <!-- Beat pair designations -->
    {#each stepPairDesignations as bp, i}
      <DesignationItem
        type="steppair"
        badge="P"
        label={formatBeatPair(bp)}
        onRemove={() => onRemoveStepPairDesignation(i)}
      />
    {/each}

    <!-- Axis-Alternating indicator (structured multi-axis pattern) -->
    {#if isAxisAlternating && axisAlternatingPattern}
      <DesignationItem
        type="axis-alternating"
        badge="A"
        label={axisAlternatingPattern.description}
      />
      <!-- Modular indicator (multiple recognizable patterns) -->
    {:else if isModular}
      <DesignationItem
        type="modular"
        badge="M"
        label="Modular (multiple patterns)"
      />
      <!-- Freeform indicator (no recognizable patterns) -->
    {:else if isFreeform}
      <DesignationItem
        type="freeform"
        badge="F"
        label="Freeform (no recognizable pattern)"
      />
    {/if}
  {/if}
</div>

<style>
  .designations-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 48px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-md);
    color: var(--muted);
  }

  .empty-text {
    font-size: var(--font-size-sm);
  }

  .empty-hint {
    font-size: var(--font-size-xs);
    margin-top: 2px;
  }
</style>
