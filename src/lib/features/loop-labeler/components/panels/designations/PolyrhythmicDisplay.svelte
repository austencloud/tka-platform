<script lang="ts">
  /**
   * Polyrhythmic Display
   *
   * Visualizes polyrhythmic pattern detection results including
   * motion/spatial periods and zone coverage analysis.
   */
  import type { PolyrhythmicLOOPResult } from "../../../services/contracts/IPolyrhythmicDetector";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    polyrhythmic: PolyrhythmicLOOPResult;
  }

  let { polyrhythmic }: Props = $props();
</script>

<div class="polyrhythmic-section">
  <div class="polyrhythmic-header">
    <FontAwesomeIcon icon="wave-square" size="1em" />
    <span>Polyrhythmic Pattern: <strong>{polyrhythmic.polyrhythm}</strong></span
    >
  </div>

  <div class="polyrhythmic-details">
    {#if polyrhythmic.motionPeriod}
      <div class="period-row">
        <span class="period-name">Motion Period</span>
        <span class="period-num">{polyrhythmic.motionPeriod.period}</span>
        <span class="period-desc">controls rotation direction</span>
      </div>
    {/if}
    {#if polyrhythmic.spatialPeriod}
      <div class="period-row">
        <span class="period-name">Spatial Period</span>
        <span class="period-num">{polyrhythmic.spatialPeriod.period}</span>
        <span class="period-desc">controls position</span>
      </div>
    {/if}
  </div>

  <!-- Zone coverage analysis -->
  {#if polyrhythmic.zoneCoverage}
    {@const zc = polyrhythmic.zoneCoverage}
    <div class="zone-coverage">
      <div class="zone-header">
        <span class="zone-title">Zone Coverage</span>
        {#if zc.summary.isComplete}
          <span class="zone-badge complete">Complete</span>
        {:else}
          <span class="zone-badge partial"
            >{zc.summary.totalZonesCovered}/4</span
          >
        {/if}
      </div>
      <div class="zone-grid">
        <div class="zone-row" class:active={zc.summary.alphaCount > 0}>
          <span class="zone-label">α</span>
          <div class="zone-dots">
            {#each Array(8) as _, i}
              <span class="zone-dot" class:filled={i < zc.summary.alphaCount}
              ></span>
            {/each}
          </div>
          <span class="zone-count">{zc.summary.alphaCount}</span>
        </div>
        <div class="zone-row" class:active={zc.summary.betaCount > 0}>
          <span class="zone-label">β</span>
          <div class="zone-dots">
            {#each Array(8) as _, i}
              <span class="zone-dot" class:filled={i < zc.summary.betaCount}
              ></span>
            {/each}
          </div>
          <span class="zone-count">{zc.summary.betaCount}</span>
        </div>
        <div class="zone-row" class:active={zc.summary.gamma1to8Count > 0}>
          <span class="zone-label">γ₁₋₈</span>
          <div class="zone-dots">
            {#each Array(8) as _, i}
              <span
                class="zone-dot"
                class:filled={i < zc.summary.gamma1to8Count}
              ></span>
            {/each}
          </div>
          <span class="zone-count">{zc.summary.gamma1to8Count}</span>
        </div>
        <div class="zone-row" class:active={zc.summary.gamma9to16Count > 0}>
          <span class="zone-label">γ₉₋₁₆</span>
          <div class="zone-dots">
            {#each Array(8) as _, i}
              <span
                class="zone-dot"
                class:filled={i < zc.summary.gamma9to16Count}
              ></span>
            {/each}
          </div>
          <span class="zone-count">{zc.summary.gamma9to16Count}</span>
        </div>
      </div>
    </div>
  {/if}

  <div class="confidence-bar">
    <span class="confidence-label">Confidence:</span>
    <div class="confidence-track">
      <div
        class="confidence-fill"
        style="width: {polyrhythmic.confidence * 100}%"
      ></div>
    </div>
    <span class="confidence-value"
      >{Math.round(polyrhythmic.confidence * 100)}%</span
    >
  </div>
</div>

<style>
  .polyrhythmic-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.12) 0%,
      rgba(139, 92, 246, 0.06) 100%
    );
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 10px;
    margin-bottom: var(--spacing-xs);
  }

  .polyrhythmic-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: #a855f7;
    font-size: var(--font-size-sm);
  }

  .polyrhythmic-header strong {
    color: #c4b5fd;
    font-weight: 700;
  }

  .polyrhythmic-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .period-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    font-size: var(--font-size-sm);
  }

  .period-name {
    color: var(--muted-foreground);
    font-weight: 500;
    min-width: 100px;
  }

  .period-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(168, 85, 247, 0.3);
    border-radius: 6px;
    color: #c4b5fd;
    font-weight: 700;
    font-family: var(--font-mono, monospace);
  }

  .period-desc {
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    font-style: italic;
  }

  /* Zone coverage display */
  .zone-coverage {
    margin-top: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
  }

  .zone-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .zone-title {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .zone-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: var(--font-size-compact);
    font-weight: 600;
  }

  .zone-badge.complete {
    background: rgba(34, 197, 94, 0.2);
    color: var(--semantic-success);
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .zone-badge.partial {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.4);
  }

  .zone-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .zone-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 4px 6px;
    border-radius: 4px;
    opacity: 0.5;
    transition: opacity var(--duration-fast) ease;
  }

  .zone-row.active {
    opacity: 1;
    background: rgba(168, 85, 247, 0.1);
  }

  .zone-label {
    width: 32px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: #c4b5fd;
  }

  .zone-dots {
    display: flex;
    gap: 3px;
    flex: 1;
  }

  .zone-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    transition: background var(--duration-fast) ease;
  }

  .zone-dot.filled {
    background: #a855f7;
  }

  .zone-count {
    width: 16px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--muted-foreground);
    text-align: right;
  }

  .confidence-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding-left: 1.5em;
    font-size: var(--font-size-xs);
  }

  .confidence-label {
    color: var(--muted-foreground);
  }

  .confidence-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    background: linear-gradient(90deg, #a855f7, #c4b5fd);
    border-radius: 3px;
    transition: width var(--duration-emphasis) ease;
  }

  .confidence-value {
    color: var(--foreground);
    font-weight: 600;
    min-width: 3em;
    text-align: right;
  }
</style>
