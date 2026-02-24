<!--
PageDivider - Visual separator between pages in scroll mode
Shows a numbered section marker with decorative lines
-->
<script lang="ts">
  let {
    pageNumber,
    label,
  }: {
    pageNumber: number;
    label?: string;
  } = $props();
</script>

<div class="page-divider" role="separator" aria-label="Section {pageNumber}">
  <div class="divider-line"></div>
  <div class="divider-badge">
    <span class="badge-number">{pageNumber}</span>
    {#if label}
      <span class="badge-label">{label}</span>
    {/if}
  </div>
  <div class="divider-line"></div>
</div>

<style>
  .page-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--theme-stroke, rgba(255, 255, 255, 0.15)),
      transparent
    );
  }

  .divider-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
  }

  .badge-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--theme-accent, #22d3ee);
    border-radius: 50%;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-on-accent, #000);
  }

  .badge-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--theme-text-dim);
  }
</style>
