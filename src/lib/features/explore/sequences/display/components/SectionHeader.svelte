<script lang="ts">
  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const { title } = $props<{
    title: string;
  }>();
</script>

<!-- Section Header - always visible, no collapse/expand -->
<div class="section-header">
  <div class="section-header-content">
    <div class="section-title-row">
      <h3 class="section-title">{title}</h3>
    </div>
    <div class="section-divider"></div>
  </div>
</div>

<style>
  .section-header {
    margin-bottom: var(--spacing-xs);
    width: 100%;
  }

  .section-header-content {
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: default;
    display: block;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-min, 14px); /* Minimum readable size */
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text));
    white-space: nowrap;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .section-divider {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      var(--theme-stroke) 0%,
      var(--theme-stroke) 40%,
      transparent 100%
    );
  }
</style>
