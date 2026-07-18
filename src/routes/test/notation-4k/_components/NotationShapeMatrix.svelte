<figure class="matrix-figure">
  <div
    class="matrix-graphic"
    role="img"
    aria-label="A twelve by twelve grid of left-hand and right-hand driving-style combinations with matched styles highlighted on the diagonal"
  >
    <span class="axis axis-x">Left-hand driving styles (12)</span>
    <span class="axis axis-y">Right-hand driving styles (12)</span>
    <div class="matrix" aria-hidden="true">
      {#each Array.from({ length: 144 }) as _, i (i)}
        <span class="cell" class:matched={i % 12 === Math.floor(i / 12)}></span>
      {/each}
    </div>
  </div>
  <figcaption>
    The diagonal holds matched styles. Every off-diagonal cell is a hybrid.
  </figcaption>
</figure>

<style>
  .matrix-figure {
    container: shape-matrix / inline-size;
    width: min(100%, 52rem);
    margin: 0 auto;
  }

  .matrix-graphic {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: clamp(0.45rem, 1.4cqi, 0.9rem);
  }

  .axis {
    color: var(--theme-text-dim, #aaa5bc);
    font-family: "Inter", system-ui, sans-serif;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .axis-x {
    grid-column: 2;
    text-align: center;
  }

  .axis-y {
    grid-row: 2;
    align-self: center;
    writing-mode: vertical-rl;
    rotate: 180deg;
  }

  .matrix {
    display: grid;
    grid-column: 2;
    grid-row: 2;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 2px;
    aspect-ratio: 1;
    padding: clamp(0.65rem, 2cqi, 1.2rem);
    background: var(--theme-card-bg, rgba(18, 18, 34, 0.72));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-lg, 1rem);
  }

  .cell {
    aspect-ratio: 1;
    border-radius: 2px;
    background: color-mix(
      in oklch,
      var(--theme-text-dim, #aaa5bc) 24%,
      transparent
    );
  }

  .cell.matched {
    background: color-mix(in oklch, #f59e0b 72%, #3b2b16);
    box-shadow: 0 0 0 1px color-mix(in oklch, #f59e0b 35%, transparent);
  }

  figcaption {
    max-width: 38rem;
    margin: 0.85rem auto 0;
    color: var(--theme-text-dim, #aaa5bc);
    font-family: "Inter", system-ui, sans-serif;
    font-size: clamp(
      var(--font-size-compact, 0.75rem),
      0.72rem + 0.12cqi,
      0.95rem
    );
    line-height: 1.55;
    text-align: center;
  }
</style>
