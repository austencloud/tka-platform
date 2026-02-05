<!--
MotionTypeReviewGrid - Summary grid showing all motion types
-->
<script lang="ts">
  import { MOTION_TYPE_INFO } from "../../../../domain/constants/motion-quiz-data";
</script>

<div class="type-review">
  <h4>Motion Types Review</h4>
  <div class="review-grid">
    {#each MOTION_TYPE_INFO as type}
      <div class="review-item" style="--type-color: {type.color}">
        <span class="review-num">{type.num}</span>
        <span class="review-name">{type.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .type-review {
    width: 100%;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .type-review h4 {
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

  .review-num {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--type-color);
    color: black;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 4px;
  }

  .review-name {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--type-color);
  }

  @media (max-width: 480px) {
    .review-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
