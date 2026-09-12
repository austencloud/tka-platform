<!--
HandRelationshipPanel.svelte - the Hand Relationship drill screen.

One SegmentedControl for the relationship (exactly one is active, so it is
the owner per chip-primitives.md) and one FilterChipBase toggle for Inverted.
The hints stack in one grid cell so switching options never moves the toggle.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    HAND_RELATIONSHIPS,
    HAND_RELATIONSHIP_HINTS,
    HAND_RELATIONSHIP_INVERTED_HINT,
    HAND_RELATIONSHIP_LABELS,
    type HandRelationship,
  } from "$lib/shared/create/domain/hand-relationship";

  let {
    relationship,
    inverted,
    haptic = null,
    onRelationshipChange,
    onInvertedChange,
  }: {
    relationship: HandRelationship;
    inverted: boolean;
    haptic?: HapticFeedback | null;
    onRelationshipChange: (v: HandRelationship) => void;
    onInvertedChange: (v: boolean) => void;
  } = $props();

  const options = HAND_RELATIONSHIPS.map((value) => ({
    value,
    label: HAND_RELATIONSHIP_LABELS[value],
  }));

  function handleRelationship(v: HandRelationship) {
    haptic?.trigger("selection");
    onRelationshipChange(v);
  }

  function handleInverted() {
    haptic?.trigger("selection");
    onInvertedChange(!inverted);
  }
</script>

<div class="relationship-panel">
  <SegmentedControl
    {options}
    value={relationship}
    onchange={handleRelationship}
    size="sm"
    density="compact"
    semantics="radiogroup"
    ariaLabel="Hand relationship"
  />
  <span class="hint">
    {#each HAND_RELATIONSHIPS as value (value)}
      <span class="hint-layer" class:live={relationship === value}
        >{HAND_RELATIONSHIP_HINTS[value]}</span
      >
    {/each}
  </span>
  <div class="inverted-row">
    <FilterChipBase
      label="Inverted"
      mode="toggle"
      emphasis="solid"
      active={inverted}
      disabled={relationship === "free"}
      onclick={handleInverted}
    />
    <span class="inverted-hint">{HAND_RELATIONSHIP_INVERTED_HINT}</span>
  </div>
</div>

<style>
  .relationship-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    flex: 1;
    justify-content: center;
  }

  /* Every hint is stacked in one grid cell so the block is always as tall as
     its longest line; picking an option cannot shove the toggle around. */
  .hint {
    display: grid;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.5);
  }

  .hint-layer {
    grid-area: 1 / 1;
    visibility: hidden;
  }

  .hint-layer.live {
    visibility: visible;
  }

  .inverted-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .inverted-hint {
    flex: 1 1 200px;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
