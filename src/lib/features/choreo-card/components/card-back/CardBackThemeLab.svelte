<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import CardBack from "./CardBack.svelte";
  import type { CardBackThemeVisuals } from "./card-back-theme-visuals";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import { onMount, onDestroy } from "svelte";

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let sequence: SequenceData | null = $state(null);
  let selectedVariant: number | null = $state(null);

  onMount(async () => {
    await engine.initialize();
    if (engine.sequences.length > 0) sequence = engine.sequences[0]!;
  });

  onDestroy(() => engine.destroy());

  interface ThemeVariant {
    label: string;
    description: string;
    visuals: CardBackThemeVisuals;
  }

  const OCEAN_VARIANTS: ThemeVariant[] = [
    {
      label: "A — Abyss",
      description: "Thin teal-chrome border, triple-dot, full fish, deep black-blue void",
      visuals: {
        borderGradient: "linear-gradient(135deg, #042f2e 0%, #0891b2 15%, #a5f3fc 30%, #cffafe 50%, #a5f3fc 70%, #0891b2 85%, #042f2e 100%)",
        background: "linear-gradient(180deg, #081a28 0%, #0c2535 35%, #102d42 55%, #0c2232 80%, #081a28 100%)",
        accentColor: "#22d3ee",
        brandGradient: "linear-gradient(180deg, rgba(207,250,254,0.98) 0%, rgba(165,243,252,0.9) 30%, rgba(207,250,254,0.98) 50%, rgba(34,211,238,0.8) 100%)",
        brandSubGradient: "linear-gradient(180deg, rgba(165,243,252,0.85) 0%, rgba(34,211,238,0.7) 50%, rgba(165,243,252,0.85) 100%)",
        ornamentColor: "rgba(165,243,252,0.8)",
        ornamentLineColor: "rgba(34,211,238,0.6)",
        brandStyle: "uppercase-sans",
        ornamentType: "triple-dot",
        borderWidth: 1.8,
        brandGlow: "drop-shadow(0 0 3cqi rgba(34, 211, 238, 0.25))",
        decorationOpacity: 1,
      },
    },
    {
      label: "B — Trench",
      description: "Thick aqua-chrome border, diamond, heavy fish, subtle cyan bloom",
      visuals: {
        borderGradient: "linear-gradient(180deg, #0c4a6e 0%, #06b6d4 12%, #a5f3fc 28%, #ecfeff 50%, #a5f3fc 72%, #06b6d4 88%, #0c4a6e 100%)",
        background: "radial-gradient(ellipse at 50% 50%, rgba(8,145,178,0.08) 0%, transparent 50%), linear-gradient(180deg, #0a2538 0%, #0e2d45 40%, #122f4a 60%, #0a2035 100%)",
        accentColor: "#67e8f9",
        brandGradient: "linear-gradient(180deg, rgba(236,254,255,0.99) 0%, rgba(165,243,252,0.92) 30%, rgba(236,254,255,0.99) 50%, rgba(34,211,238,0.75) 100%)",
        brandSubGradient: "linear-gradient(180deg, rgba(165,243,252,0.85) 0%, rgba(34,211,238,0.7) 50%, rgba(165,243,252,0.85) 100%)",
        ornamentColor: "rgba(165,243,252,0.8)",
        ornamentLineColor: "rgba(34,211,238,0.6)",
        brandStyle: "uppercase-sans",
        ornamentType: "diamond",
        borderWidth: 3.2,
        brandGlow: "drop-shadow(0 0 5cqi rgba(34, 211, 238, 0.3))",
        decorationOpacity: 1.5,
      },
    },
    {
      label: "C — Drift",
      description: "Medium horizontal chrome sweep, double-line, faded fish, italic serif brand",
      visuals: {
        borderGradient: "linear-gradient(90deg, #042f2e 0%, #0e7490 12%, #a5f3fc 28%, #cffafe 45%, #a5f3fc 55%, #cffafe 72%, #0e7490 88%, #042f2e 100%)",
        background: "linear-gradient(180deg, #091e2e 0%, #0d2a3c 40%, #103048 70%, #091e2e 100%)",
        accentColor: "#a5f3fc",
        brandGradient: "linear-gradient(180deg, rgba(207,250,254,0.95) 0%, rgba(103,232,249,0.82) 40%, rgba(207,250,254,0.95) 50%, rgba(14,116,144,0.7) 100%)",
        brandSubGradient: "linear-gradient(180deg, rgba(165,243,252,0.82) 0%, rgba(34,211,238,0.65) 50%, rgba(165,243,252,0.82) 100%)",
        ornamentColor: "rgba(165,243,252,0.78)",
        ornamentLineColor: "rgba(34,211,238,0.55)",
        brandStyle: "italic-serif",
        ornamentType: "double-line",
        borderWidth: 2.5,
        brandGlow: "drop-shadow(0 0 4cqi rgba(103, 232, 249, 0.2))",
        decorationOpacity: 0.5,
      },
    },
    {
      label: "D — Fathom",
      description: "Thin silver-teal border, star ornament, no fish, pure dark ocean, small-caps",
      visuals: {
        borderGradient: "linear-gradient(135deg, #0a1628 0%, #155e75 15%, #e0f2fe 30%, #f0f9ff 50%, #e0f2fe 70%, #155e75 85%, #0a1628 100%)",
        background: "linear-gradient(180deg, #081820 0%, #0c2230 50%, #081820 100%)",
        accentColor: "#bae6fd",
        brandGradient: "linear-gradient(180deg, rgba(240,249,255,0.99) 0%, rgba(186,230,253,0.93) 35%, rgba(240,249,255,0.99) 50%, rgba(125,211,252,0.85) 100%)",
        brandSubGradient: "linear-gradient(180deg, rgba(186,230,253,0.85) 0%, rgba(125,211,252,0.7) 50%, rgba(186,230,253,0.85) 100%)",
        ornamentColor: "rgba(186,230,253,0.8)",
        ornamentLineColor: "rgba(125,211,252,0.6)",
        brandStyle: "small-caps",
        ornamentType: "star",
        borderWidth: 1.5,
        brandGlow: "none",
        decorationOpacity: 0,
      },
    },
  ];

  function selectVariant(idx: number) {
    selectedVariant = selectedVariant === idx ? null : idx;
  }

  function printTestSheet() {
    window.print();
  }
</script>

<div class="theme-lab">
  <div class="lab-header">
    <h2>Ocean Theme — Pick Your Favorite</h2>
    {#if selectedVariant !== null}
      <span class="selected-badge">Selected: {OCEAN_VARIANTS[selectedVariant]!.label}</span>
    {/if}
    <button class="print-btn" type="button" onclick={printTestSheet}>
      <i class="fas fa-print" aria-hidden="true"></i>
      Print Test Sheet
    </button>
  </div>

  <div class="variants-grid">
    {#each OCEAN_VARIANTS as variant, i}
      <button
        class="variant-card"
        class:selected={selectedVariant === i}
        onclick={() => selectVariant(i)}
        type="button"
        aria-pressed={selectedVariant === i}
        aria-label={`${variant.label} card-back variant — ${variant.description}`}
      >
        <div class="variant-label">{variant.label}</div>
        <div class="card-container">
          {#if sequence}
            <CardBack
              {sequence}
              themeOverride={{ visuals: variant.visuals, name: "ocean" }}
            />
          {/if}
        </div>
        <div class="variant-desc">{variant.description}</div>
      </button>
    {/each}
  </div>
</div>

<style>
  .theme-lab {
    width: 100%;
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  .lab-header {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .lab-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .selected-badge {
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--theme-accent, rgba(100,130,255,0.25));
    border: 1px solid var(--theme-accent-border, rgba(100,130,255,0.5));
    color: var(--theme-text, #fff);
    font-size: 12px;
    font-weight: 500;
  }

  .print-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15));
    background: var(--theme-card-bg, rgba(255,255,255,0.06));
    color: var(--theme-text, #fff);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .print-btn:hover {
    background: var(--theme-card-hover, rgba(255,255,255,0.1));
  }

  .variants-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: 1fr 1fr;
    gap: 12px;
    flex: 1;
    min-height: 0;
  }

  .variant-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: var(--theme-card-bg, rgba(255,255,255,0.03));
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    text-align: left;
    color: inherit;
    font: inherit;
    min-height: 0;
    overflow: hidden;
  }

  .variant-card:hover {
    background: var(--theme-card-hover, rgba(255,255,255,0.06));
    border-color: var(--theme-stroke, rgba(255,255,255,0.15));
  }

  .variant-card.selected {
    border-color: var(--theme-accent, #6366f1);
    background: var(--theme-card-hover, rgba(100,130,255,0.08));
  }

  .variant-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    flex-shrink: 0;
  }

  .card-container {
    flex: 1;
    min-height: 0;
    border-radius: 6px;
    overflow: hidden;
    container-type: inline-size;
    aspect-ratio: 2.5 / 3.5;
    max-height: 100%;
    width: auto;
    margin: 0 auto;
  }

  .variant-desc {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
    line-height: 1.3;
    flex-shrink: 0;
  }

  /* ═══════ PRINT STYLES ═══════ */
  @media print {
    /* Hide everything else on the page */
    :global(body > *:not(.theme-lab-print-root)) {
      display: none !important;
    }

    .theme-lab {
      position: fixed;
      inset: 0;
      padding: 0;
      overflow: visible;
      height: auto;
      background: white;
    }

    .lab-header {
      display: none;
    }

    .variants-grid {
      display: grid;
      grid-template-columns: repeat(2, 2.5in);
      grid-template-rows: repeat(2, 3.5in);
      gap: 0.25in;
      justify-content: center;
      align-content: center;
      padding: 0.25in;
      height: auto;
      flex: none;
    }

    .variant-card {
      padding: 0;
      border: none;
      border-radius: 0;
      background: none;
      gap: 0;
      width: 2.5in;
      height: 3.5in;
      overflow: hidden;
    }

    .variant-label {
      position: absolute;
      bottom: -14px;
      left: 0;
      font-size: 7pt;
      color: #333;
    }

    .variant-desc {
      display: none;
    }

    .card-container {
      width: 2.5in;
      height: 3.5in;
      aspect-ratio: unset;
      max-height: unset;
      border-radius: 4px;
    }

    .print-btn {
      display: none;
    }

    .selected-badge {
      display: none;
    }
  }

  @page {
    size: letter landscape;
    margin: 0.25in;
  }
</style>
