<!--
VTGModeReviewGrid - Grid showing all VTG modes for review
-->
<script lang="ts">
  import { VTG_MODES } from "../../../../domain/constants/vtg-quiz-data";
</script>

<div class="mode-review">
  <h4>VTG Modes Review</h4>
  <div class="review-grid">
    {#each VTG_MODES as vtgMode}
      <div class="review-item" style="--type-color: {vtgMode.color}">
        <span class="review-code">{vtgMode.mode}</span>
        <span class="review-name">{vtgMode.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .mode-review {
    width: 100%;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .mode-review h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text-dim);
    margin: 0 0 0.75rem 0;
  }

  .review-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .review-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem;
    background: color-mix(in srgb, var(--type-color) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--type-color) 20%, transparent);
    border-radius: 6px;
  }

  .review-code {
    font-family: monospace;
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--type-color);
  }

  .review-name {
    font-size: 0.5625rem;
    font-weight: 600;
    color: var(--type-color);
    opacity: 0.8;
  }

  @media (max-width: 480px) {
    .review-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
