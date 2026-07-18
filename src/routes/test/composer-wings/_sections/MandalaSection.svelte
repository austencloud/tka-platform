<!--
  MandalaSection: TEST-page showcase (marketing preview, not shipping code).

  BEAT A: the Shape Matrix baseline (real ShapeMatrixGrid, client-only).

  BEAT B: the curated showcase. Renders CHOSEN_MANDALAS (baked by the Choose
  button on /test/mandala-pick) with the real SequenceMandala, breathing. No auth.
  Empty until picks are chosen; points at the picker until then.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import ShapeMatrixGrid from "$lib/features/lab/vtg-lab/components/ShapeMatrixGrid.svelte";
  import {
    loadShapeMatrix,
    type ShapeMatrixData,
  } from "$lib/features/lab/vtg-lab/services/shape-matrix-flowers";
  import {
    flowerKey,
    type Flower,
  } from "$lib/features/lab/vtg-lab/domain/flower-signature";
  import { CHOSEN_MANDALAS } from "./chosen-mandalas";

  const MATRIX_KEYS = [
    "anti-0.5-in-diamond",
    "pro-1-in-diamond",
    "anti-1.5-in-diamond",
    "pro-2-in-diamond",
    "anti-3-in-diamond",
  ];

  let matrixData = $state<ShapeMatrixData | null>(null);
  let matrixErr = $state(false);
  let reducedMotion = $state(false);
  let sizes = $state<number[]>([]);

  const matrixAxis = $derived.by((): Flower[] => {
    if (!matrixData) return [];
    const byKey = new Map(matrixData.axis.map((f) => [flowerKey(f), f]));
    return MATRIX_KEYS.map((k) => byKey.get(k)).filter((f): f is Flower => !!f);
  });

  onMount(() => {
    if (!browser) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const onMq = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
    mq.addEventListener("change", onMq);

    let disposed = false;
    void (async () => {
      try {
        const data = await loadShapeMatrix();
        if (!disposed) matrixData = data;
      } catch (err) {
        console.error("[MandalaSection] shape matrix load failed", err);
        if (!disposed) matrixErr = true;
      }
    })();

    return () => {
      disposed = true;
      mq.removeEventListener("change", onMq);
    };
  });
</script>

<section class="depth-showcase">
  <!-- BEAT A: the Shape Matrix, the structural baseline -->
  <div class="beat">
    <div class="beat-copy">
      <h3 class="beat-heading">Every shape pairing has its own mandala</h3>
      <p class="beat-caption">The Shape Matrix: every hand-shape against every hand-shape.</p>
    </div>

    <div class="matrix-frame" class:is-placeholder={!matrixData}>
      {#if browser && matrixData && matrixAxis.length}
        <ShapeMatrixGrid
          data={matrixData}
          rowAxis={matrixAxis}
          colAxis={matrixAxis}
          maxCellPx={96}
          onselect={() => {}}
        />
      {:else}
        <span class="frame-status">
          {matrixErr ? "Shape matrix unavailable." : "Building the shape matrix…"}
        </span>
      {/if}
    </div>
  </div>

  <!-- BEAT B: the curated, breathing showcase -->
  <div class="beat">
    <div class="beat-copy">
      <h3 class="beat-heading">Shapes only the Kinetic Alphabet can make</h3>
      <p class="beat-caption">
        Hand-picked from the collection, drawn live and breathing as they turn. Non-radial
        orientations and reversed hand paths reach shapes the radial shape system never could.
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

  .matrix-frame {
    position: relative;
    width: 100%;
    max-width: 620px;
    margin-inline: auto;
    height: clamp(360px, 60vw, 540px);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid oklch(0.5 0.03 270 / 0.18);
    box-shadow: 0 12px 30px oklch(0.1 0.02 270 / 0.35);
    background: #0a0f14;
  }
  .matrix-frame.is-placeholder {
    display: grid;
    place-items: center;
  }
  .frame-status {
    font-size: 0.9rem;
    color: oklch(0.66 0.02 270);
  }

  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
