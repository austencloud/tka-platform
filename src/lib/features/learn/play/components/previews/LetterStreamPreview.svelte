<!--
  Speed Blitz — hub preview. The letters ARE the game, so they're REAL now:
  Kinetic Alphabet glyphs in the actual TKA Letters webfont, two marquee rows
  streaming leftward with the lower row faster ("the letters come faster"
  made literal), sized with container units so the stream fills the stage.
  Transform-only marquee; [data-paused] and reduced-motion freeze it.
-->
<script lang="ts">
  let { accent }: { accent: string } = $props();

  /* Doubled sets make the -50% translate loop seamless. Arbitrary letter
     sample — visual, not a domain statement. */
  const ROW_A = ["E", "G", "K", "M", "P", "S", "A", "C"];
  const ROW_B = ["B", "D", "F", "J", "L", "N", "Q", "T"];
</script>

<div class="stage" style="--accent: {accent}" aria-hidden="true">
  <div class="row slow">
    <div class="track">
      {#each [...ROW_A, ...ROW_A] as letter, i (i)}
        <span class="tka-font">{letter}</span>
      {/each}
    </div>
  </div>
  <div class="row fast">
    <div class="track">
      {#each [...ROW_B, ...ROW_B] as letter, i (i)}
        <span class="tka-font">{letter}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    container-type: size;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6cqh;
    overflow: hidden;
  }

  .row {
    overflow: hidden;
    white-space: nowrap;
  }

  .track {
    display: inline-flex;
    gap: 7cqi;
    padding-inline: 3.5cqi;
    animation: stream var(--speed, 16s) linear infinite;
    will-change: transform;
  }

  .row.slow {
    --speed: 18s;
  }

  .row.fast {
    --speed: 9s;
  }

  span {
    font-family: "TKA Letters", var(--font-sans, sans-serif);
    font-feature-settings: "liga" 1, "dlig" 1;
    font-size: 30cqh;
    line-height: 1;
    color: var(--accent);
    text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent);
    opacity: 0.92;
  }

  .row.fast span {
    opacity: 0.62;
  }

  @keyframes stream {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .track {
      animation: none;
    }
  }
</style>
