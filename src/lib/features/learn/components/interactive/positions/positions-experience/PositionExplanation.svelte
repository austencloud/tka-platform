<!--
PositionExplanation - Explanation box for a position type
-->
<script lang="ts">
  import type { PositionInfo } from "../../../../domain/constants/positions-experience-data";

  let {
    info,
  }: {
    info: PositionInfo;
  } = $props();
</script>

<div class="explanation">
  <h3>Understanding {info.name}</h3>
  <p class="description">{info.description}</p>
  <p class="insight">{info.keyInsight}</p>
</div>

<style>
  .explanation {
    padding: 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .description {
    font-size: 1rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.75));
    line-height: 1.6;
    margin: 0.75rem 0 0;
  }

  .insight {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
    margin: 0.5rem 0 0;
    font-style: italic;
  }
</style>
