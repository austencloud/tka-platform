<!--
MotionTypeSummary - Summary grid of all motion types
-->
<script lang="ts">
  import { MOTION_INFO } from "../../../../domain/constants/motion-experience-data";
</script>

<div class="type-summary">
  <h3>Motion Types Summary</h3>
  <div class="summary-grid">
    {#each [1, 2, 3, 4, 5, 6] as t}
      {@const info = MOTION_INFO[t]}
      {#if info}
        <div class="summary-item" style="--type-color: {info.color}">
          <span class="summary-num">{t}</span>
          <span class="summary-name">{info.name}</span>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .type-summary {
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.625rem;
    margin-top: 1rem;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem;
    background: color-mix(in srgb, var(--type-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--type-color) 25%, transparent);
    border-radius: 8px;
  }

  .summary-num {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--type-color);
    color: black;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 6px;
  }

  .summary-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--type-color);
  }

  @media (max-width: 600px) {
    .summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
