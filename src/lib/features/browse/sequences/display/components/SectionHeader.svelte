<script lang="ts">
  const { title } = $props<{
    title: string;
  }>();

  // Parse "R (8 STEPS) (3 SEQUENCES)" into parts
  const parsed = $derived.by(() => {
    const clean = title.replace(/^[^\w\d]*/u, "").trim();
    // Extract the main label (everything before the first parenthetical)
    const mainMatch = clean.match(/^([^(]+)/);
    const label = mainMatch ? mainMatch[1].trim() : clean;

    // Extract count from "(N SEQUENCE(S))"
    const countMatch = clean.match(/\((\d+)\s*sequences?\)/i);
    const count = countMatch ? parseInt(countMatch[1], 10) : null;

    // Extract step info from "(N STEPS)"
    const stepsMatch = clean.match(/\((\d+)\s*steps?\)/i);
    const steps = stepsMatch ? parseInt(stepsMatch[1], 10) : null;

    return { label, count, steps };
  });
</script>

<div class="section-header">
  <div class="section-header-content">
    <div class="section-title-row">
      <h3 class="section-title">{parsed.label}</h3>
      {#if parsed.steps}
        <span class="section-meta">{parsed.steps} beats</span>
      {/if}
      {#if parsed.count}
        <span class="section-count">{parsed.count}</span>
      {/if}
      <div class="section-divider"></div>
    </div>
  </div>
</div>

<style>
  .section-header {
    margin-bottom: var(--spacing-sm, 8px);
    margin-top: var(--spacing-md, 12px);
    width: 100%;
  }

  .section-header:first-child {
    margin-top: 0;
  }

  .section-header-content {
    width: 100%;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  .section-meta {
    font-size: var(--font-size-compact, 12px);
    font-weight: 400;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
    flex-shrink: 0;
  }

  .section-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    background: rgba(255, 255, 255, 0.06);
    padding: 1px 8px;
    border-radius: 10px;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .section-divider {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      var(--theme-stroke, rgba(255, 255, 255, 0.08)) 0%,
      transparent 100%
    );
    min-width: 40px;
  }
</style>
