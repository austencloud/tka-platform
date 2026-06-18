<!--
  Browse-module loading skeleton. Mirrors BrowseModule: a left section-index rail
  beside a responsive card grid. Reserves both panes so the real grid fills in
  without shifting the rail.
-->
<div class="browse-skeleton" role="status" aria-live="polite" aria-busy="true">
  <div class="bs-rail">
    {#each Array(6) as _, i (i)}
      <div class="bs-rail-item"></div>
    {/each}
  </div>
  <div class="bs-grid">
    {#each Array(12) as _, i (i)}
      <div class="bs-card"></div>
    {/each}
  </div>
  <span class="sr-only">Loading Browse…</span>
</div>

<style>
  .browse-skeleton {
    display: grid;
    grid-template-columns: minmax(7rem, 12%) 1fr;
    gap: var(--spacing-md, 1rem);
    width: 100%;
    height: 100%;
    padding: var(--spacing-md, 1rem);
    box-sizing: border-box;
  }
  .bs-rail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
  }
  .bs-rail-item { height: 1.75rem; }
  .bs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    grid-auto-rows: 10rem;
    gap: var(--spacing-sm, 0.5rem);
    align-content: start;
    overflow: hidden;
  }
  .bs-rail-item,
  .bs-card {
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
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bs-rail-item, .bs-card { animation: none; }
  }
</style>
