<!--
ConceptContext - Subtle prev/next indicators

Simple inline display showing journey position
-->
<script lang="ts">
  import { CONCEPT_CATEGORIES } from "../domain/concepts";
  import type { LearnConcept } from "../domain/types";

  let {
    previousConcept,
    nextConcept,
  }: {
    previousConcept?: LearnConcept;
    nextConcept?: LearnConcept;
  } = $props();
</script>

<div class="concept-context">
  <div class="context-side prev">
    {#if previousConcept}
      {@const cat = CONCEPT_CATEGORIES[previousConcept.category]}
      <i class="fa-solid fa-check" aria-hidden="true" style="color: {cat.color}"
      ></i>
      <span class="name">{previousConcept.shortName}</span>
    {:else}
      <i class="fa-solid fa-flag" aria-hidden="true"></i>
      <span class="name">Start</span>
    {/if}
  </div>

  <div class="connector">
    <div class="line"></div>
    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    <div class="line"></div>
  </div>

  <div class="context-side next">
    {#if nextConcept}
      {@const cat = CONCEPT_CATEGORIES[nextConcept.category]}
      <span class="name">{nextConcept.shortName}</span>
      <i
        class="fa-solid fa-arrow-right"
        aria-hidden="true"
        style="color: {cat.color}"
      ></i>
    {:else}
      <span class="name">Complete!</span>
      <i class="fa-solid fa-trophy" aria-hidden="true" style="color: #FFD700"
      ></i>
    {/if}
  </div>
</div>

<style>
  .concept-context {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
  }

  .context-side {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .context-side i {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .context-side .name {
    font-size: 0.8125rem;
    color: var(--theme-text-dim);
    font-weight: 500;
  }

  .prev .name {
    color: var(--theme-text-dim);
  }

  .connector {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--theme-stroke);
  }

  .connector .line {
    width: 20px;
    height: 1px;
    background: var(--theme-stroke, var(--theme-card-bg));
  }

  .connector i {
    font-size: 0.5rem;
  }
</style>
