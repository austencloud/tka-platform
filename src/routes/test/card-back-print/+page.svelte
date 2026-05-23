<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";
  import { getDarkThemeVisuals, getProofModeVisuals } from "$lib/features/choreo-card/components/card-back/card-back-theme-visuals";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import { onMount, onDestroy } from "svelte";

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let sequence: SequenceData | null = $state(null);
  let proofMode = $state(true);
  let fontChoice = $state("palatino");

  const FONTS: Record<string, string> = {
    palatino: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    garamond: 'Garamond, "EB Garamond", "Times New Roman", serif',
    didot: 'Didot, "Bodoni MT", "Playfair Display", Georgia, serif',
    copperplate: '"Copperplate Gothic", Copperplate, "Century Gothic", sans-serif',
  };

  const brandFont = $derived(FONTS[fontChoice]!);

  onMount(async () => {
    await engine.initialize();
    if (engine.sequences.length > 0) sequence = engine.sequences[0]!;
  });

  onDestroy(() => engine.destroy());

  const themes = ["cosmic", "ocean", "winter", "ember", "blossom", "forest", "autumn", "rainbow"] as const;

  const cards = $derived(
    themes.map((name) => ({
      name,
      visuals: proofMode ? getProofModeVisuals(name) : getDarkThemeVisuals(name),
    }))
  );
</script>

<svelte:head>
  <title>Card Back — Print Test</title>
</svelte:head>

<div class="test-page">
  <div class="screen-header">
    <h1>Print Test — All 8 Themes</h1>
    <div class="controls">
      <button
        class="mode-btn"
        class:active={proofMode}
        type="button"
        onclick={() => proofMode = true}
      >
        Proof Mode (saves ink)
      </button>
      <button
        class="mode-btn"
        class:active={!proofMode}
        type="button"
        onclick={() => proofMode = false}
      >
        Final Mode (dark)
      </button>
    </div>
    <div class="controls">
      {#each Object.keys(FONTS) as font}
        <button
          class="mode-btn"
          class:active={fontChoice === font}
          type="button"
          onclick={() => fontChoice = font}
        >
          {font}
        </button>
      {/each}
    </div>
    <p>{proofMode ? "White background, colored accents — checks layout, text, and sizing without burning ink." : "Full dark design — how it will look from a professional printer."}</p>
    <button class="print-btn" type="button" onclick={() => window.print()}>
      Print These Cards
    </button>
  </div>

  <div class="cards-row">
    {#each cards as card}
      <div class="card-frame">
        <div class="card-slot" style="--brand-font: {brandFont};">
          {#if sequence}
            <CardBack {sequence} themeOverride={card} />
          {/if}
        </div>
        <span class="card-label">{card.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .test-page {
    width: 100vw;
    min-height: 100vh;
    background: #111;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px;
    gap: 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .screen-header {
    text-align: center;
    color: #ccc;
  }

  .screen-header h1 {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 600;
    color: #fff;
  }

  .controls {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 12px;
  }

  .mode-btn {
    padding: 8px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.05);
    color: #888;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-btn.active {
    background: rgba(99,102,241,0.3);
    border-color: rgba(99,102,241,0.5);
    color: #fff;
  }

  .screen-header p {
    margin: 0 0 16px;
    font-size: 13px;
    color: #666;
    max-width: 500px;
  }

  .print-btn {
    padding: 10px 28px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(99,102,241,0.3);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .print-btn:hover {
    background: rgba(99,102,241,0.5);
  }

  .cards-row {
    display: grid;
    grid-template-columns: repeat(4, 2.5in);
    gap: 24px 20px;
    justify-content: center;
  }

  .card-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .card-slot {
    width: 2.5in;
    height: 3.5in;
    container-type: inline-size;
    border-radius: 6px;
    overflow: hidden;
  }

  .card-label {
    font-size: 13px;
    color: #888;
    text-transform: capitalize;
  }

  @media print {
    .screen-header {
      display: none;
    }

    .test-page {
      background: white;
      padding: 0;
      gap: 0;
      justify-content: center;
      min-height: auto;
      height: 100vh;
    }

    .cards-row {
      grid-template-columns: repeat(4, 2.5in);
      gap: 0.06in 0;
    }

    .card-frame {
      gap: 0;
    }

    .card-slot {
      width: 2.5in;
      height: 3.5in;
    }

    .card-label {
      font-size: 7pt;
      color: #333;
      margin-top: 4px;
    }
  }

  @page {
    size: letter landscape;
    margin: 0.5in;
  }
</style>
