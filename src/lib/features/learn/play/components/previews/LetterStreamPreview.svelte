<!--
  LetterStreamPreview — hub-card preview for Speed Blitz.

  Two rows of Kinetic Alphabet letters streaming leftward, the lower row
  faster — the blitz promise ("the letters come faster") made literal. Each
  row holds its run twice and slides -50% for a seamless marquee loop; a mask
  fades the edges so letters materialize and vanish instead of clipping.
  Transform-only keyframes. Reduced-motion shows the letters at rest.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();
</script>

<div class="preview" style="--accent: {accent}">
  <div class="row row-a">
    <span class="run tka-font">A C E G K M P S</span>
    <span class="run tka-font" aria-hidden="true">A C E G K M P S</span>
  </div>
  <div class="row row-b">
    <span class="run tka-font">B D F J L N Q T</span>
    <span class="run tka-font" aria-hidden="true">B D F J L N Q T</span>
  </div>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    overflow: hidden;
    mask-image: linear-gradient(
      90deg,
      transparent,
      black 14%,
      black 86%,
      transparent
    );
  }

  .row {
    display: flex;
    width: max-content;
    animation: stream 13s linear infinite;
  }

  .row-b {
    animation-duration: 7.5s;
    opacity: 0.65;
  }

  .run {
    display: block;
    padding-right: 28px;
    white-space: nowrap;
    font-size: 30px;
    line-height: 1;
    letter-spacing: 16px;
    color: var(--accent);
    text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent);
  }

  /* The row holds its run twice, so -50% is exactly one run width:
     the loop restart lands on identical pixels. */
  @keyframes stream {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .row {
      animation: none;
    }
  }
</style>
