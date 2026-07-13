<!--
  ComposerHeroDemo

  The one live embed on the /composer marketing page: a real sequence
  (CΨΩX, a rotated LOOP pulled from the public library) playing in the
  standalone InlineAnimationPlayer with minimal chrome.

  The player chunk is heavy (whole animation engine), so it goes through
  LazyMount and only starts importing after hydration hits idle. The stage
  box is fixed with aspect-ratio so the prose below never shifts when the
  player mounts (no-layout-shift rule).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import demoJson from "../_data/demo-sequence.json";

  const sequence = demoJson as unknown as SequenceData;
  const word = simplifyRepeatedWord(sequence.word);

  let active = $state(false);

  onMount(() => {
    // Static prerendered page: let the prose paint first, then pull the engine.
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => (active = true), { timeout: 2500 });
    } else {
      setTimeout(() => (active = true), 300);
    }
  });
</script>

<figure class="hero-demo">
  <div class="demo-stage">
    <LazyMount
      loader={() =>
        import(
          "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
        )}
      {active}
      props={{
        sequence,
        autoPlay: true,
        chrome: "minimal",
        fill: true,
      }}
    />
  </div>
  <figcaption>
    <span class="tka-font demo-word">{word}</span>
    <span class="demo-note">a rotated LOOP from the generator, animating live</span>
  </figcaption>
</figure>

<style>
  .hero-demo {
    margin: 2.4rem auto 0;
    max-width: min(26rem, 100%);
  }

  .demo-stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: 18px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  figcaption {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.55rem;
    margin-top: 0.8rem;
    font-size: 0.85rem;
    color: oklch(0.6 0.02 270);
  }

  .demo-word {
    font-size: 1.05rem;
    color: oklch(0.88 0.03 270);
  }

  .demo-note {
    font-style: italic;
  }
</style>
