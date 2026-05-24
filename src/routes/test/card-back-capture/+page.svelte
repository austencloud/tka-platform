<script lang="ts">
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import { renderCardBack } from "$lib/features/choreo-card/services/card-back-dom-renderer";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";
  import { getProofModeVisuals } from "$lib/features/choreo-card/components/card-back/card-back-theme-visuals";
  import type { CardBackThemeVisuals } from "$lib/features/choreo-card/components/card-back/card-back-theme-visuals";
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  const MPC_WIDTH = 750;
  const MPC_HEIGHT = 1050;
  const MPC_BLEED = 0;
  const CARD_COUNT = 8;

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let cards: { url: string; name: string }[] = $state([]);
  let sequence: SequenceData | null = $state(null);
  let status = $state("Loading sequences...");

  const FONT_VARIANTS: { label: string; style: "uppercase-sans" | "italic-serif" | "small-caps" }[] = [
    { label: "Uppercase Didot (current)", style: "uppercase-sans" },
    { label: "Italic Serif", style: "italic-serif" },
    { label: "Small Caps", style: "small-caps" },
  ];

  function makeThemeOverride(brandStyle: string): { visuals: CardBackThemeVisuals; name: string } {
    const base = getProofModeVisuals("ocean");
    return {
      visuals: { ...base, brandStyle: brandStyle as CardBackThemeVisuals["brandStyle"] },
      name: "ocean",
    };
  }

  onMount(async () => {
    await engine.initialize();
    const seqs = engine.sequences.slice(0, CARD_COUNT);
    if (seqs.length === 0) { status = "No sequences found."; return; }
    sequence = seqs[0]!;
    status = `Capturing ${seqs.length} cards...`;
    await captureAll(seqs);
  });

  onDestroy(() => {
    engine.destroy();
    for (const c of cards) URL.revokeObjectURL(c.url);
  });

  async function captureAll(seqs: SequenceData[]) {
    const results: { url: string; name: string }[] = [];
    for (const seq of seqs) {
      const canvas = await renderCardBack(seq, {
        width: MPC_WIDTH,
        height: MPC_HEIGHT,
        bleedPx: MPC_BLEED,
        theme: "ocean",
      });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r));
      if (blob) {
        results.push({
          url: URL.createObjectURL(blob),
          name: seq.word ?? `${seq.steps?.length ?? 0} beats`,
        });
      }
    }
    cards = results;
    status = `Captured ${results.length} cards at ${MPC_WIDTH}x${MPC_HEIGHT}`;
  }
</script>

<svelte:head>
  <title>Card Back Capture Test</title>
</svelte:head>

<div class="page">
  <h1>Card Back Capture — Grid Artifact Test</h1>
  <p class="status">{status}</p>

  {#if cards.length > 0}
    <h2>Grid size (~160px) — check for artifacts</h2>
    <div class="grid">
      {#each cards as card}
        <div class="card-cell">
          <img src={card.url} alt={card.name} />
          <span class="label">{card.name}</span>
        </div>
      {/each}
    </div>

    <h2>Medium (~250px)</h2>
    <div class="grid medium">
      {#each cards as card}
        <div class="card-cell">
          <img src={card.url} alt={card.name} />
        </div>
      {/each}
    </div>
  {/if}

  {#if sequence}
    <h2>Font Comparison — "The Kinetic Alphabet"</h2>
    <div class="font-compare">
      {#each FONT_VARIANTS as variant}
        <div class="font-card">
          <div class="card-slot">
            <CardBack {sequence} themeOverride={makeThemeOverride(variant.style)} />
          </div>
          <span class="font-label">{variant.label}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    background: #111;
    color: #ccc;
    min-height: 100vh;
    padding: 32px;
    font-family: system-ui, sans-serif;
  }
  h1 { color: #fff; font-size: 20px; margin: 0 0 8px; }
  h2 { color: #aaa; font-size: 14px; margin: 16px 0 8px; }
  .status { color: #888; font-size: 13px; margin: 0 0 16px; }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .card-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .card-cell img { width: 160px; border: 1px solid #333; border-radius: 4px; }
  .grid.medium .card-cell img { width: 250px; }
  .label { font-size: 11px; color: #666; }

  .font-compare {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  .font-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .card-slot {
    width: 250px;
    height: 350px;
    container-type: inline-size;
    overflow: hidden;
  }
  .font-label {
    font-size: 13px;
    color: #aaa;
    font-weight: 500;
  }
</style>
