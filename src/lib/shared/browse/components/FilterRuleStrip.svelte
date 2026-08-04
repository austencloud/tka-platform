<!--
FilterRuleStrip — the grouped rule sentence.

Renders the active rule as one readable sentence — "Start: Alpha or Beta ·
Level: 1 or 2 · LOOPs: Mirrored and Swapped" — instead of a flat chip row.
Values stay individual chips: chip body edits (opens that category's editor),
the split × removes just that value. The connective word between values
mirrors the applied semantics (see filter-rule-groups.ts).

Shared by the Smart Collection builder today and, per the unified filter
workspace spec, the main gallery next — one component, never a copy.
-->
<script lang="ts">
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import {
    groupRuleFilters,
    type RuleStripFilter,
  } from "$lib/shared/browse/services/filter-rule-groups";
  import type { FilterConnectives } from "$lib/shared/browse/services/multi-filter";

  let {
    filters,
    connectives,
    onEditFilter,
    onRemoveFilter,
  }: {
    filters: readonly RuleStripFilter[];
    /** Match any / all choices for connective-bearing categories. */
    connectives?: FilterConnectives;
    /** Chip body action: open that category's editor. */
    onEditFilter: (type: string) => void;
    /** Split × action: remove that one value. */
    onRemoveFilter: (key: string) => void;
  } = $props();

  const groups = $derived(groupRuleFilters(filters, connectives));
</script>

<div class="rule-sentence" aria-label="Current rule">
  {#each groups as group, groupIndex (group.type)}
    {#if groupIndex > 0}
      <span class="group-sep" aria-hidden="true">·</span>
    {/if}
    <!-- display: contents — the group is semantic only; label, connective
         words, and chips all flow (and wrap) in the strip's own flex line. -->
    <span class="rule-group" role="group" aria-label={group.label}>
      <span class="group-label">{group.label}:</span>
      {#each group.chips as chip, chipIndex (chip.key)}
        {#if chipIndex > 0 && group.connectiveWord}
          <span class="connective-word">{group.connectiveWord}</span>
        {/if}
        <FilterChipBase
          label={chip.displayLabel}
          active
          mode="action"
          size="sm"
          chipColor={chip.chipColor}
          ariaLabel={`Edit ${chip.label} filter`}
          onclick={() => onEditFilter(chip.type)}
          onremove={() => onRemoveFilter(chip.key)}
          removeAriaLabel={`Remove ${chip.label} filter`}
        />
      {/each}
    </span>
  {/each}
</div>

<style>
  .rule-sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.45rem;
    min-width: 0;
  }

  .rule-group {
    display: contents;
  }

  .group-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.72));
    white-space: nowrap;
  }

  .connective-word,
  .group-sep {
    font-size: 0.8rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .group-sep {
    margin-inline: 0.15rem;
  }
</style>
