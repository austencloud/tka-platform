<!--
  PictographShufflePreview — hub-card preview for Name That Pictograph.

  Three Kinetic Alphabet glyphs (real TKA Letters webfont, so the card shows
  the actual symbols the game quizzes on) take turns rising into the stage,
  holding, and fading out — the feel of flash cards being dealt. Pure CSS
  keyframes on transform/opacity only; the shared observer in PlayHub pauses
  it offscreen, and reduced-motion collapses to a static "A" frame.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();
</script>

<div class="preview" style="--accent: {accent}">
  <span class="glyph tka-font g1">A</span>
  <span class="glyph tka-font g2">K</span>
  <span class="glyph tka-font g3">S</span>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  /* All three glyphs share one grid cell so swapping never reflows the box. */
  .glyph {
    grid-area: 1 / 1;
    font-size: 58px;
    line-height: 1;
    color: var(--accent);
    text-shadow: 0 0 26px color-mix(in srgb, var(--accent) 55%, transparent);
    opacity: 0;
    animation: shuffle 5.4s ease-in-out infinite;
  }

  /* Base opacity 1 on the first glyph = the static frame under reduced
     motion (base styles only apply once the animation is removed). */
  .g1 {
    opacity: 1;
    animation-delay: -0.3s;
  }
  .g2 {
    animation-delay: 1.5s;
  }
  .g3 {
    animation-delay: 3.3s;
  }

  @keyframes shuffle {
    0% {
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    6% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    30% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    36%,
    100% {
      opacity: 0;
      transform: translateY(-10px) scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glyph {
      animation: none;
    }
  }
</style>
