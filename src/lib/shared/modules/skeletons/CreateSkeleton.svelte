<!--
  Create-module loading skeleton. Mirrors StandardWorkspaceLayout: a top toolbar
  strip over a beat-grid workspace. Reserves the same boxes the real module fills
  so content swaps in without reflow.
-->
<div class="create-skeleton" role="status" aria-live="polite" aria-busy="true">
  <div class="cs-toolbar">
    <div class="cs-chip"></div>
    <div class="cs-chip"></div>
    <div class="cs-chip"></div>
    <div class="cs-spacer"></div>
    <div class="cs-chip cs-chip-wide"></div>
  </div>
  <div class="cs-workspace">
    {#each Array(8) as _, i (i)}
      <div class="cs-cell"></div>
    {/each}
  </div>
  <span class="sr-only">Loading Create…</span>
</div>

<style>
  .create-skeleton {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: var(--spacing-md, 1rem);
    padding: var(--spacing-md, 1rem);
    box-sizing: border-box;
  }
  .cs-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 0.5rem);
    height: 3rem;
    flex: 0 0 auto;
  }
  .cs-spacer { flex: 1 1 auto; }
  .cs-workspace {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 1fr;
    gap: var(--spacing-sm, 0.5rem);
    min-height: 0;
  }
  .cs-chip,
  .cs-chip-wide,
  .cs-cell {
    border-radius: var(--radius-md, 0.5rem);
    background: linear-gradient(
      90deg,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 25%,
      var(--surface-3, rgba(255, 255, 255, 0.12)) 37%,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
  .cs-chip { width: 4.5rem; height: 2rem; }
  .cs-chip-wide { width: 8rem; height: 2rem; }
  .cs-cell { min-height: 0; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-chip, .cs-chip-wide, .cs-cell { animation: none; }
  }
</style>
