<!--
  OptionPulsePreview — hub-card preview for Picture This (letter → pictograph).

  A 2×2 grid of answer cells with an accent selection ring hopping from cell
  to cell — the game's core act: scanning four pictograph options for the one
  that matches the letter. The ring's glow is a static box-shadow; only its
  transform animates (compositor-cheap). Reduced-motion parks the ring on the
  first cell.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();
</script>

<div class="preview" style="--accent: {accent}">
  <div class="grid">
    <span class="cell"></span>
    <span class="cell"></span>
    <span class="cell"></span>
    <span class="cell"></span>
    <span class="ring"></span>
  </div>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, 34px);
    grid-template-rows: repeat(2, 34px);
    gap: 10px;
  }

  .cell {
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.13);
  }

  .ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 2px solid var(--accent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 55%, transparent);
    animation: hop 4.8s ease-in-out infinite;
  }

  /* Hold on each cell, then a quick 5%-of-cycle slide to the next —
     reads as "considering, then moving on". 44px = cell + gap. */
  @keyframes hop {
    0%,
    20% {
      transform: translate(0, 0);
    }
    25%,
    45% {
      transform: translate(44px, 0);
    }
    50%,
    70% {
      transform: translate(44px, 44px);
    }
    75%,
    95% {
      transform: translate(0, 44px);
    }
    100% {
      transform: translate(0, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring {
      animation: none;
    }
  }
</style>
