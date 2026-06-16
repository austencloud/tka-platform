<script lang="ts">
  import TurnMatrixGrid from "$lib/features/choreo-card/components/TurnMatrixGrid.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import VariationPicker from "./VariationPicker.svelte";
  import { resolveRotationStyleMatrices, type RotationStyleMatrix, type StyleVariation } from "../services/resolve-rotation-style-matrices";

  let matrices = $state<RotationStyleMatrix[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Open picker context (null = closed).
  let picker = $state<{ variations: StyleVariation[]; turnPattern: string; accent: string } | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    resolveRotationStyleMatrices()
      .then((res) => (matrices = res))
      .catch((e) => (error = e instanceof Error ? e.message : "Failed to load"))
      .finally(() => (loading = false));
  });

  function turnKey(blue: number, red: number): string {
    const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    return `${f(blue)}|${f(red)}`;
  }
</script>

<div class="explorer">
  <p class="intro">
    The mandala is set by <strong>prop rotation</strong> and turns — not the VTG mode. These three are
    every fingerprint there is; pick a cell to choose which letter wears it.
  </p>

  {#if loading}
    <div class="status" role="status">Loading sequences…</div>
  {:else if error}
    <div class="status err" role="alert"><i class="fas fa-triangle-exclamation"></i> {error}</div>
  {:else}
    <div class="axis-key" aria-hidden="true">
      <span class="ak blue"><i class="fas fa-arrow-down"></i> Blue turns</span>
      <span class="scale">0 · 0.5 · 1 · 1.5 · 2 · 2.5 · 3</span>
      <span class="ak red">Red turns <i class="fas fa-arrow-right"></i></span>
    </div>
    <div class="panels">
      {#each matrices as m (m.style)}
        <section class="panel" style="--accent: {m.accent};">
          <h3><span class="dot"></span>{m.label}</h3>
          <TurnMatrixGrid ariaLabel="{m.label} turn matrix" showAxes={false}>
            {#snippet cell(blue: number, red: number)}
              {@const seq = m.byTurn.get(turnKey(blue, red))}
              {#if seq}
                <button
                  type="button"
                  class="cell"
                  class:diag={blue === red}
                  style="--bloom: {(blue + red) / 6};"
                  aria-label="{m.label} blue {blue} red {red} — pick a letter"
                  onclick={() => (picker = { variations: m.variations, turnPattern: turnKey(blue, red), accent: m.accent })}
                >
                  <SequenceMandala sequence={seq} mode="gallery" show="both" size={120} darkMode />
                </button>
              {:else}
                <div class="empty" aria-label="No sequence for {blue}|{red}"></div>
              {/if}
            {/snippet}
          </TurnMatrixGrid>
        </section>
      {/each}
    </div>
  {/if}
</div>

{#if picker}
  <VariationPicker
    variations={picker.variations}
    turnPattern={picker.turnPattern}
    accent={picker.accent}
    onClose={() => (picker = null)}
  />
{/if}

<style>
  .explorer { display: flex; flex-direction: column; gap: 1rem; }
  .intro { margin: 0; font-size: var(--font-size-min, 14px); color: var(--theme-text-secondary, #9fb2bd); max-width: 60ch; }
  .intro strong { color: var(--theme-text, #fff); }
  .status { padding: 2rem; text-align: center; color: var(--theme-text-secondary, #888); font-size: var(--font-size-min, 14px); }
  .status.err { color: #fbbf24; }

  .axis-key { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; font-size: var(--font-size-compact, 12px); color: var(--theme-text-secondary, #888); }
  .ak { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; }
  .ak.blue { color: #60a5fa; }
  .ak.red { color: #f87171; }
  .scale { font-variant-numeric: tabular-nums; opacity: 0.7; letter-spacing: 0.04em; }

  .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; align-items: start; }
  .panel {
    display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; padding: 0.9rem; border-radius: 16px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid color-mix(in srgb, var(--accent) 32%, rgba(255, 255, 255, 0.08));
    box-shadow: 0 2px 24px color-mix(in srgb, var(--accent) 12%, transparent);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }
  .panel h3 { display: flex; align-items: center; gap: 0.45rem; margin: 0; font-size: var(--font-size-min, 14px); font-weight: 700; letter-spacing: 0.08em; color: var(--theme-text, #fff); }
  .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 70%, transparent); flex-shrink: 0; }

  .cell {
    width: 100%; aspect-ratio: 1; padding: 2px; border: none; background: transparent; cursor: pointer;
    border-radius: clamp(4px, 1cqi, 8px); transition: transform 0.12s ease, background 0.12s ease;
    display: flex; align-items: center; justify-content: center;
  }
  .cell :global(svg) { width: 100%; height: 100%; filter: drop-shadow(0 0 calc(var(--bloom, 0) * 7px) color-mix(in srgb, var(--accent) calc(var(--bloom, 0) * 55%), transparent)); }
  .cell.diag { background: radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }
  .cell:hover { transform: scale(1.1); background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .cell:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 1px; }
  @media (prefers-reduced-motion: reduce) { .cell { transition: none; } }
  .empty { width: 100%; aspect-ratio: 1; border-radius: clamp(4px, 1cqi, 8px); background: rgba(255, 255, 255, 0.012); }
</style>
