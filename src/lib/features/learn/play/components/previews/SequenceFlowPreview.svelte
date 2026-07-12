<!--
  SequenceFlowPreview — hub-card preview for What Comes Next (valid-next).

  Two settled steps, then a dashed open slot with two candidates hovering
  above and below it. Each candidate takes a turn sliding into the slot and
  retreating — the game's question ("which pictograph can legally follow?")
  told in pure shapes. Transform/opacity keyframes only. Reduced-motion shows
  the resting question: filled, filled, open slot flanked by both candidates.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();
</script>

<div class="preview" style="--accent: {accent}">
  <div class="row">
    <span class="slot filled"></span>
    <span class="slot filled"></span>
    <span class="slot open">
      <span class="candidate up"></span>
      <span class="candidate down"></span>
    </span>
  </div>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .slot {
    width: 36px;
    height: 36px;
    border-radius: 9px;
  }

  .filled {
    background: color-mix(in srgb, var(--accent) 22%, rgba(255, 255, 255, 0.05));
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  }

  .open {
    position: relative;
    border: 1.5px dashed color-mix(in srgb, var(--accent) 60%, transparent);
  }

  .candidate {
    position: absolute;
    inset: 3px;
    border-radius: 7px;
    background: var(--accent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 45%, transparent);
  }

  /* Base transforms double as the reduced-motion static frame: both
     candidates visibly waiting above/below the open slot. */
  .up {
    transform: translateY(-26px) scale(0.85);
    opacity: 0.55;
    animation: offer-up 4.5s ease-in-out infinite;
  }

  .down {
    transform: translateY(26px) scale(0.85);
    opacity: 0.55;
    animation: offer-down 4.5s ease-in-out infinite;
  }

  @keyframes offer-up {
    0%,
    8% {
      transform: translateY(-26px) scale(0.85);
      opacity: 0.55;
    }
    18%,
    32% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    42%,
    100% {
      transform: translateY(-26px) scale(0.85);
      opacity: 0.55;
    }
  }

  @keyframes offer-down {
    0%,
    58% {
      transform: translateY(26px) scale(0.85);
      opacity: 0.55;
    }
    68%,
    82% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    92%,
    100% {
      transform: translateY(26px) scale(0.85);
      opacity: 0.55;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .candidate {
      animation: none;
    }
  }
</style>
