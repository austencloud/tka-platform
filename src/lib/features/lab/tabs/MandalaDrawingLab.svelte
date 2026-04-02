<!--
  Mandala Drawing Lab

  Experiment: live mandala tracing during animation playback.
  The overlay draws prop tip paths frame-by-frame on a persistent canvas,
  accumulating a mandala pattern that matches the card-back mandala geometry.

  Status: Early prototype. Two approaches explored:
  1. Frame-by-frame line segments (tracks live tip positions) — works but choppy
  2. Pre-computed progressive reveal (setLineDash) — smoother but needs integration work

  Next steps:
  - Fix progressive reveal to use actual pre-computed paths from MandalaGeometryCalculator
  - Head-chasing-tail fade after first loop
  - Purple blending where blue and red overlap
  - Settings panel (stroke width, fade duration, show/hide props)
-->
<script lang="ts">
  const notes = [
    "Frame-by-frame approach tracks actual prop tips but produces choppy straight-line segments",
    "Progressive reveal approach uses pre-computed Catmull-Rom bezier paths (same as card-back mandala) but needs AnimationEngine integration",
    "The MandalaOverlayCanvas, MandalaPathPreparer, and IMandalaOverlayCanvas infrastructure files exist in src/lib/shared/mandala/",
    "Spec docs: docs/superpowers/specs/2026-03-31-live-mandala-drawing-design.md",
    "Implementation plan: docs/superpowers/plans/2026-04-01-mandala-progressive-reveal.md",
  ];
</script>

<div class="lab-container">
  <header class="lab-header">
    <h1>Mandala Drawing</h1>
    <p class="subtitle">Live mandala tracing during animation playback</p>
  </header>

  <div class="lab-content">
    <section class="status-card">
      <h2>Status: Prototype</h2>
      <p>
        This experiment draws mandala patterns live as the animation plays,
        creating a screensaver-like effect. The pattern persists on screen
        and fades after the first loop completes.
      </p>
    </section>

    <section class="notes-card">
      <h2>Implementation Notes</h2>
      <ul>
        {#each notes as note}
          <li>{note}</li>
        {/each}
      </ul>
    </section>

    <section class="files-card">
      <h2>Infrastructure Files</h2>
      <ul class="file-list">
        <li><code>shared/mandala/services/implementations/MandalaOverlayCanvas.ts</code></li>
        <li><code>shared/mandala/services/implementations/MandalaPathPreparer.ts</code></li>
        <li><code>shared/mandala/services/contracts/IMandalaOverlayCanvas.ts</code></li>
        <li><code>shared/mandala/services/contracts/IMandalaPathPreparer.ts</code></li>
        <li><code>shared/mandala/domain/mandala-overlay-types.ts</code></li>
      </ul>
    </section>
  </div>
</div>

<style>
  .lab-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    gap: 20px;
    overflow-y: auto;
  }

  .lab-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .subtitle {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, #888);
    margin-top: 4px;
  }

  .lab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 20px;
  }

  h2 {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: #c084fc;
    margin-bottom: 12px;
  }

  p, li {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, #aaa);
    line-height: 1.6;
  }

  ul {
    padding-left: 20px;
  }

  li {
    margin-bottom: 6px;
  }

  .file-list code {
    font-size: var(--font-size-compact, 12px);
    color: #c084fc;
    background: rgba(192, 132, 252, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
