<!--
  MandalaBloomPreview — hub-card preview for Mandala Match.

  Concentric dashed rings counter-rotating at different speeds around a
  center point, the whole group breathing — evokes a sequence mandala without
  mounting the real SequenceMandala (too costly for a hub card, per the
  plan). SVG dash patterns make the rotation visible; only transforms
  animate. Reduced-motion shows the still rings.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();
</script>

<div class="preview" style="--accent: {accent}">
  <svg viewBox="0 0 200 125" aria-hidden="true">
    <g class="bloom">
      <circle class="core" cx="100" cy="62.5" r="3" />
      <circle class="ring r1" cx="100" cy="62.5" r="17" />
      <circle class="ring r2" cx="100" cy="62.5" r="29" />
      <circle class="ring r3" cx="100" cy="62.5" r="41" />
      <circle class="ring r4" cx="100" cy="62.5" r="51" />
    </g>
  </svg>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .core {
    fill: var(--accent);
  }

  .ring {
    fill: none;
    stroke: var(--accent);
    transform-box: view-box;
    transform-origin: 100px 62.5px;
  }

  .r1 {
    stroke-width: 2;
    stroke-dasharray: 6 8;
    opacity: 0.8;
    animation: spin 14s linear infinite;
  }

  .r2 {
    stroke-width: 1.5;
    stroke-dasharray: 2 10;
    opacity: 0.55;
    animation: spin-rev 22s linear infinite;
  }

  .r3 {
    stroke-width: 2;
    stroke-dasharray: 14 12;
    opacity: 0.4;
    animation: spin 30s linear infinite;
  }

  .r4 {
    stroke-width: 1;
    stroke-dasharray: 1 7;
    opacity: 0.3;
    animation: spin-rev 40s linear infinite;
  }

  .bloom {
    transform-box: view-box;
    transform-origin: 100px 62.5px;
    animation: breathe 9s ease-in-out infinite alternate;
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

  @keyframes breathe {
    from {
      transform: scale(0.94);
    }
    to {
      transform: scale(1.04);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring,
    .bloom {
      animation: none;
    }
  }
</style>
