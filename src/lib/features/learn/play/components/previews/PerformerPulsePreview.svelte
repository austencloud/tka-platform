<!--
  PerformerPulsePreview — hub-card preview for Read the Performer.

  A minimal stick-figure silhouette with two accent prop-tips orbiting it in
  opposite directions — the game asks you to read a moving performer, so the
  card shows exactly that. Orbits are the classic zero-size-pivot trick: a
  0×0 wrapper centered on the figure rotates (its own center is the pivot)
  and carries a translated dot. Transform-only. Reduced-motion freezes the
  dots at rest beside the figure.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();
</script>

<div class="preview" style="--accent: {accent}">
  <svg
    class="figure"
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
  >
    <circle cx="50" cy="20" r="8" />
    <path d="M50 28 L50 58" />
    <path d="M50 38 L31 28 M50 38 L69 28" />
    <path d="M50 58 L38 82 M50 58 L62 82" />
  </svg>
  <span class="orbit orbit-a"><span class="dot"></span></span>
  <span class="orbit orbit-b"><span class="dot dot-b"></span></span>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.7);
  }

  .figure {
    height: 74%;
    opacity: 0.6;
  }

  .orbit {
    position: absolute;
    left: 50%;
    top: 48%;
    width: 0;
    height: 0;
    animation: spin 4.2s linear infinite;
  }

  .orbit-b {
    animation: spin-rev 6.4s linear infinite;
  }

  .dot {
    position: absolute;
    left: -5px;
    top: -5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 60%, transparent);
    transform: translateX(40px);
  }

  .dot-b {
    width: 8px;
    height: 8px;
    opacity: 0.8;
    transform: translateX(-31px);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-rev {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(-360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .orbit {
      animation: none;
    }
  }
</style>
