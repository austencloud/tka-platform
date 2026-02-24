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
      <div class="position-card">
        <span class="greek-symbol" aria-hidden="true">{info.symbol}</span>
        <span class="card-name">{info.name}</span>
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
    color: var(--theme-text);
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
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 8%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .greek-symbol {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1;
    color: var(--theme-text);
  }

  .card-name {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--theme-text);
  }

  .position-card small {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim);
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
