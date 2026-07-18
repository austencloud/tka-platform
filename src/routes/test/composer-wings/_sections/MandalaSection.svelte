<!--
  MandalaSection: TEST-page showcase (marketing preview, not shipping code).

  BEAT A: the Shape Matrix baseline (real ShapeMatrixGrid, client-only).

  BEAT B: a PICKING pass over Austen's saved mandala collection, BAKED into
  showcase-mandalas.ts (36 entries, pulled via the admin SDK) so it renders with
  no auth and no sign-in. Numbered static tiles; click to mark the coolest, read
  the numbers back, and this array gets trimmed to the curated picks (which then
  animate/breathe in the final). The 1.3MB baked file is temporary and gets
  trimmed to the chosen few before this ships anywhere.
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
  import { SHOWCASE_MANDALAS } from "./showcase-mandalas";

  // Beat A: five visually-varied diamond flowers, both axes, so the diagonal
  // overlaps into clean purple pictographs. Petal spread: 3, 2, 5, 4, 8.
  const MATRIX_KEYS = [
    "anti-0.5-in-diamond",
    "pro-1-in-diamond",
    "anti-1.5-in-diamond",
    "pro-2-in-diamond",
    "anti-3-in-diamond",
  ];

  let matrixData = $state<ShapeMatrixData | null>(null);
  let matrixErr = $state(false);

  // One measured width per tile drives its mandala's crisp `size`.
  let sizes = $state<number[]>([]);

  // Picking: which tiles are marked (0-based indices into SHOWCASE_MANDALAS).
  let selected = $state<Set<number>>(new Set());
  const keepList = $derived(
    [...selected].sort((a, b) => a - b).map((n) => n + 1).join(", "),
  );

  const matrixAxis = $derived.by((): Flower[] => {
    if (!matrixData) return [];
    const byKey = new Map(matrixData.axis.map((f) => [flowerKey(f), f]));
    return MATRIX_KEYS.map((k) => byKey.get(k)).filter((f): f is Flower => !!f);
  });

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    selected = next;
  }

  onMount(() => {
    if (!browser) return;
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

  <!-- BEAT B: PICK the coolest from the baked collection -->
  <div class="beat">
    <div class="beat-copy">
      <h3 class="beat-heading">Shapes only the Kinetic Alphabet can make</h3>
      <p class="beat-caption">
        Hand-picked from the collection, drawn live and breathing as they turn. Non-radial
        orientations and reversed hand paths reach shapes the radial shape system never could.
      </p>
    </div>

    <div class="pick-bar">
      <span class="pick-hint">
        {SHOWCASE_MANDALAS.length} of your saved mandalas. Click the coolest, then read me the numbers.
      </span>
      {#if keepList}<span class="pick-msg">Keep: {keepList}</span>{/if}
    </div>

    <div class="tile-grid">
      {#each SHOWCASE_MANDALAS as m, i (m.id)}
        <button
          type="button"
          class="stage pick"
          class:selected={selected.has(i)}
          aria-pressed={selected.has(i)}
          onclick={() => toggle(i)}
          bind:clientWidth={sizes[i]}
        >
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
              animate: false,
            }}
          />
          <span class="idx">{i + 1}</span>
          {#if selected.has(i)}<span class="pick-check">✓</span>{/if}
        </button>
      {/each}
    </div>
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

  .pick-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .pick-hint {
    font-size: 0.85rem;
    color: oklch(0.62 0.02 270);
  }
  .pick-msg {
    font-size: 0.85rem;
    font-weight: 640;
    color: oklch(0.82 0.14 150);
  }

  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: clamp(0.8rem, 0.5rem + 1vw, 1.2rem);
  }
  .stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: 14px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: oklch(0.16 0.018 270 / 0.55);
    border: 1px solid oklch(0.5 0.03 270 / 0.18);
    box-shadow: 0 10px 24px oklch(0.1 0.02 270 / 0.3);
  }
  .stage.pick {
    cursor: pointer;
    padding: 0;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }
  .stage.pick:hover {
    transform: translateY(-2px);
    border-color: oklch(0.7 0.1 275 / 0.5);
  }
  .stage.selected {
    border-color: oklch(0.75 0.16 275);
    box-shadow:
      0 0 0 2px oklch(0.75 0.16 275) inset,
      0 12px 30px oklch(0.4 0.16 275 / 0.4);
  }
  .idx {
    position: absolute;
    top: 6px;
    left: 8px;
    font-size: 0.78rem;
    font-weight: 720;
    color: oklch(0.78 0.02 270);
    background: oklch(0.12 0.02 270 / 0.7);
    border-radius: 6px;
    padding: 0.05rem 0.35rem;
    font-variant-numeric: tabular-nums;
  }
  .pick-check {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 0.95rem;
    font-weight: 800;
    color: oklch(0.85 0.16 275);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
</style>
