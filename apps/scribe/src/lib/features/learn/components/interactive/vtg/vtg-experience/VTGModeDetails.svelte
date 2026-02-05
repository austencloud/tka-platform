<!--
VTGModeDetails - Shows direction and timing details for a mode
-->
<script lang="ts">
  let {
    directionLabel,
    timingLabel,
    color,
  }: {
    directionLabel: string;
    timingLabel: string;
    color: string;
  } = $props();
</script>

<div class="mode-details" style="--type-color: {color}">
  <div class="detail-row">
    <span class="detail-label">Direction:</span>
    <span class="detail-value">{directionLabel}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Timing:</span>
    <span class="detail-value">{timingLabel}</span>
  </div>
</div>

<style>
  .mode-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.9375rem;
  }

  .detail-label {
    color: var(--theme-text-dim);
  }

  .detail-value {
    color: var(--type-color);
    font-weight: 600;
  }
</style>
