<script lang="ts">
  import type { ConceptCategory } from "../domain/types";
  import { CONCEPT_CATEGORIES } from "../domain/concepts";

  let {
    category,
    completedCount = 0,
    totalCount = 0,
    premiumGated = false,
  } = $props<{
    category: ConceptCategory;
    completedCount?: number;
    totalCount?: number;
    premiumGated?: boolean;
  }>();
</script>

<header class="category-heading">
  <h3>{CONCEPT_CATEGORIES[category].name}</h3>
  <span class="count">{completedCount} of {totalCount} completed</span>
  {#if premiumGated}<span class="premium">Premium</span>{/if}
</header>

<style>
  .category-heading {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 650;
    color: var(--theme-text);
  }
  .count,
  .premium {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }
</style>
