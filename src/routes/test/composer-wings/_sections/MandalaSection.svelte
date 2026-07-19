<!--
  MandalaSection: TEST-page showcase (marketing preview, not shipping code).

  The curated, breathing showcase: renders CHOSEN_MANDALAS (baked by the Choose
  button on /test/mandala-pick) with the real SequenceMandala, undulating as they
  turn. No auth. Empty until picks are chosen; points at the picker until then.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import { CHOSEN_MANDALAS } from "./chosen-mandalas";

  let reducedMotion = $state(false);
  let sizes = $state<number[]>([]);

  onMount(() => {
    if (!browser) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const onMq = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  });
</script>

<section class="depth-showcase">
  <div class="beat">
    <div class="beat-copy">
      <h3 class="beat-heading">Shapes only the Kinetic Alphabet can make</h3>
      <p class="beat-caption">
        Hand-picked from the collection, drawn live and breathing as they turn. Non-radial
        orientations and reversed hand paths reach shapes older systems never could.
      </p>
    </div>

    {#if CHOSEN_MANDALAS.length}
      <div class="tile-grid">
        {#each CHOSEN_MANDALAS as m, i (m.id)}
          <div class="stage" bind:clientWidth={sizes[i]}>
            <LazyMount
              loader={() => import("$lib/shared/mandala/components/SequenceMandala.svelte")}
              active={browser && sizes[i] > 0}
              props={{
                sequence: { steps: m.steps },
                size: sizes[i] || 300,
                show: m.variant,
                style: "stroke",
                bluePropType: m.bluePropType,
                redPropType: m.redPropType,
                pathShape: "arc",
                strokeWidth: 2.5,
                animate: !reducedMotion,
                animateEasing: "breathe",
                animateRotation: reducedMotion ? 0 : 18,
                animatePeriod: 6 + i * 0.3,
                animateMin: 40,
                animateMax: 240,
              }}
            />
          </div>
        {/each}
      </div>
    {:else}
      <div class="collection-status">
        No picks yet. Choose them at <a href="/test/mandala-pick">/test/mandala-pick</a>.
      </div>
    {/if}
  </div>
</section>

<style>
  .depth-showcase {
    display: flex;
    flex-direction: column;
    gap: clamp(2rem, 1.4rem + 2.4vw, 3.4rem);
    padding: clamp(1rem, 0.6rem + 2vw, 2.5rem);
    color: oklch(0.9 0.02 270);
  }

  .beat {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .beat-copy {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-width: 48rem;
  }
  .beat-heading {
    margin: 0;
    font-size: clamp(1.25rem, 1.1rem + 0.8vw, 1.75rem);
    font-weight: 720;
    letter-spacing: -0.01em;
    color: oklch(0.95 0.02 270);
  }
  .beat-caption {
    margin: 0;
    font-size: clamp(0.95rem, 0.9rem + 0.2vw, 1.1rem);
    line-height: 1.55;
    color: oklch(0.68 0.02 270);
  }

  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: clamp(0.9rem, 0.6rem + 1vw, 1.4rem);
  }
  .stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: 16px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: oklch(0.16 0.018 270 / 0.55);
    border: 1px solid oklch(0.5 0.03 270 / 0.18);
    box-shadow: 0 12px 30px oklch(0.1 0.02 270 / 0.35);
  }
  .collection-status {
    padding: 2.5rem 0;
    text-align: center;
    font-size: 0.95rem;
    color: oklch(0.66 0.02 270);
  }
  .collection-status a {
    color: oklch(0.78 0.13 275);
  }
</style>
