<!--
VTGModeSummary - Summary grid showing all VTG modes before quiz
-->
<script lang="ts">
  import {
    VTG_MODES,
    VTG_MODE_INFO,
  } from "../../../../domain/constants/vtg-experience-data";
</script>

<div class="mode-summary">
  <h3>VTG Modes Summary</h3>
  <div class="summary-grid">
    {#each VTG_MODES as mode}
      {@const info = VTG_MODE_INFO[mode]}
      <div class="summary-item" style="--type-color: {info.color}">
        <span class="summary-code">{mode}</span>
        <span class="summary-name">{info.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .mode-summary {
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

  .summary-code {
    font-family: monospace;
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--type-color);
  }

  .summary-name {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--type-color);
    opacity: 0.8;
  }

  @media (max-width: 600px) {
    .summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
