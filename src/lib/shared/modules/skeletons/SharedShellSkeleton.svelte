<!--
  Generic module loading skeleton: a header bar plus a content shimmer. Used as
  the fallback for any module without a bespoke skeleton. Reserves the full
  content box so the real module fills in without layout shift.
-->
<div class="skeleton-shell" role="status" aria-live="polite" aria-busy="true">
  <div class="skeleton-bar skeleton-header"></div>
  <div class="skeleton-body">
    <div class="skeleton-block"></div>
    <div class="skeleton-block"></div>
    <div class="skeleton-block"></div>
  </div>
  <span class="sr-only">Loading…</span>
</div>

<style>
  .skeleton-shell {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 1rem);
    width: 100%;
    height: 100%;
    padding: var(--spacing-md, 1rem);
    box-sizing: border-box;
  }
  .skeleton-bar,
  .skeleton-block {
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
  .skeleton-header { height: 2.5rem; width: 40%; }
  .skeleton-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
    flex: 1 1 auto;
  }
  .skeleton-block { flex: 1 1 0; min-height: 4rem; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton-bar, .skeleton-block { animation: none; }
  }
</style>
