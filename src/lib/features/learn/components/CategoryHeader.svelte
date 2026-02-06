<!--
CategoryHeader - Simple category section divider

Displays:
- Category icon
- Category name
- Progress count (completed/total)
- Extending line
-->
<script lang="ts">
  import type { ConceptCategory } from "../domain/types";
  import { CONCEPT_CATEGORIES } from "../domain/concepts";

  let {
    category,
    completedCount = 0,
    totalCount = 0,
  }: {
    category: ConceptCategory;
    completedCount?: number;
    totalCount?: number;
  } = $props();

  const categoryInfo = $derived(
    CONCEPT_CATEGORIES[category as ConceptCategory]
  );
</script>

<div class="category-divider" style="--category-color: {categoryInfo.color}">
  <span class="icon"
    ><i class="fa-solid {categoryInfo.icon}" aria-hidden="true"></i></span
  >
  <span class="name">{categoryInfo.name}</span>
  <span class="count">{completedCount}/{totalCount}</span>
  <div class="line"></div>
</div>

<style>
  .category-divider {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .icon {
    font-size: 1rem;
    line-height: 1;
    color: var(--category-color);
    text-shadow: 0 0 12px
      color-mix(in srgb, var(--category-color) 40%, transparent);
  }

  .name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--category-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .count {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--category-color) 30%, transparent),
      transparent
    );
  }
</style>
