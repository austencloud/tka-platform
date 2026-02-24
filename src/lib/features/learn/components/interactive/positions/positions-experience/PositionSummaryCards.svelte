<!--
PositionSummaryCards - Summary cards showing all position types
-->
<script lang="ts">
  import { POSITION_INFO } from "../../../../domain/constants/positions-experience-data";
</script>

<div class="summary-section">
  <h3>Position Summary</h3>
  <div class="position-cards">
    {#each Object.entries(POSITION_INFO) as [type, info]}
      <div class="position-card {type}">
        <i class="fa-solid {info.icon}" aria-hidden="true"></i>
        <span>{info.name}</span>
        <small
          >{type === "alpha"
            ? "Opposite"
            : type === "beta"
              ? "Same"
              : "Right Angle"} ({info.angle})</small
        >
      </div>
    {/each}
  </div>
</div>

<style>
  .summary-section {
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

  .position-cards {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .position-card {
    flex: 1;
    min-width: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1rem;
    border-radius: 10px;
  }

  .position-card.alpha {
    --pos-color: #ff6b6b;
    background: color-mix(in srgb, var(--pos-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--pos-color) 25%, transparent);
    color: var(--pos-color);
  }

  .position-card.beta {
    --pos-color: #4ecdc4;
    background: color-mix(in srgb, var(--pos-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--pos-color) 25%, transparent);
    color: var(--pos-color);
  }

  .position-card.gamma {
    --pos-color: #ffe66d;
    background: color-mix(in srgb, var(--pos-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--pos-color) 25%, transparent);
    color: var(--pos-color);
  }

  .position-card i {
    font-size: 1.25rem;
  }

  .position-card span {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .position-card small {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  @media (max-width: 600px) {
    .position-cards {
      flex-direction: column;
    }

    .position-card {
      min-width: auto;
    }
  }
</style>
