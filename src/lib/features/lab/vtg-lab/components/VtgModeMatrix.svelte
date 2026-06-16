<script lang="ts">
  import TurnMatrixGrid from "$lib/features/choreo-card/components/TurnMatrixGrid.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import CardInspectModal from "$lib/features/choreo-card/components/CardInspectModal.svelte";
  import { resolveTnDFamilyCards } from "../services/resolve-tnd-family-cards";
  import type { SeedMatrix } from "../domain/tnd-turn-patterns";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";

  interface Props {
    /** TnD family id, e.g. "split-opp". */
    familyId: string;
  }
  const { familyId }: Props = $props();

  // The family's elemental accent threads through panels, the diagonal, and the
  // bloom glow so the whole mode reads in one colour.
  const elementColor = $derived(TND_BY_FAMILY[familyId]?.accentColor ?? "#60a5fa");

  let seeds = $state<SeedMatrix[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // The sequence whose full card is expanded in the inspect modal (null = closed).
  let inspected = $state<SequenceData | null>(null);

  $effect(() => {
    const fam = familyId;
    loading = true;
    error = null;
    seeds = [];
    resolveTnDFamilyCards(fam)
      .then((res) => {
        if (fam !== familyId) return; // stale
        seeds = res;
      })
      .catch((e) => {
        if (fam !== familyId) return; // stale — don't clobber a newer family
        error = e instanceof Error ? e.message : "Failed to load sequences";
      })
      .finally(() => {
        if (fam === familyId) loading = false;
      });
  });

  function turnKey(blue: number, red: number): string {
    const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    return `${f(blue)}|${f(red)}`;
  }

  // Base-seed ids are `tnd-<family>-<word>`; show just the word (e.g. "DJDJ").
  function displayWord(seedId: string): string {
    return (seedId.split("-").pop() ?? seedId).toUpperCase();
  }
</script>

{#if loading}
  <div class="status" role="status">Loading sequences…</div>
{:else if error}
  <div class="status error" role="alert"><i class="fas fa-triangle-exclamation"></i> {error}</div>
{:else if seeds.length === 0}
  <div class="status">No sequences for this family.</div>
{:else}
  <div class="gallery" style="--el: {elementColor};">
    <div class="axis-key" aria-hidden="true">
      <span class="ak-axis ak-blue"><i class="fas fa-arrow-down"></i> Blue turns</span>
      <span class="ak-scale">0 · 0.5 · 1 · 1.5 · 2 · 2.5 · 3</span>
      <span class="ak-axis ak-red">Red turns <i class="fas fa-arrow-right"></i></span>
    </div>
    <div class="seed-grid">
      {#each seeds as seed (seed.seedId)}
        <section class="seed-block">
          <h3 class="seed-title"><span class="el-dot"></span>{displayWord(seed.seedId)}</h3>
          <TurnMatrixGrid ariaLabel="{displayWord(seed.seedId)} turn matrix" showAxes={false}>
            {#snippet cell(blue: number, red: number)}
              {@const seq = seed.byTurn.get(turnKey(blue, red))}
              {#if seq}
                <button
                  type="button"
                  class="mandala-cell"
                  class:diag={blue === red}
                  style="--bloom: {(blue + red) / 6};"
                  aria-label="{displayWord(seed.seedId)} blue {blue} red {red} — expand card"
                  onclick={() => (inspected = seq)}
                >
                  <SequenceMandala sequence={seq} mode="gallery" show="both" size={120} darkMode />
                </button>
              {:else}
                <div class="card-empty" aria-label="No sequence for {blue}|{red}"></div>
              {/if}
            {/snippet}
          </TurnMatrixGrid>
        </section>
      {/each}
    </div>
  </div>
{/if}

{#if inspected}
  <CardInspectModal sequence={inspected} onClose={() => (inspected = null)} />
{/if}

<style>
  .status {
    padding: 2rem;
    text-align: center;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
  }
  .status.error { color: #fbbf24; }

  .gallery {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* One shared legend for every seed matrix — replaces the per-matrix axes. */
  .axis-key {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #888);
    padding: 0.2rem 0.1rem;
  }
  .ak-axis { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; }
  .ak-blue { color: #60a5fa; }
  .ak-red { color: #f87171; }
  .ak-scale { font-variant-numeric: tabular-nums; opacity: 0.7; letter-spacing: 0.04em; }

  /* Seed matrices side by side on wide screens; wrap/stack when narrow. */
  .seed-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
    align-items: start;
  }
  /* Glass panel floating in the ocean, edged in the family's element colour. */
  .seed-block {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    padding: 0.9rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid color-mix(in srgb, var(--el) 32%, rgba(255, 255, 255, 0.08));
    box-shadow: 0 2px 24px color-mix(in srgb, var(--el) 12%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .seed-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--theme-text, #fff);
  }
  .el-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--el);
    box-shadow: 0 0 8px color-mix(in srgb, var(--el) 70%, transparent);
    flex-shrink: 0;
  }
  .mandala-cell {
    width: 100%;
    aspect-ratio: 1;
    padding: 2px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: clamp(4px, 1cqi, 8px);
    transition: transform 0.12s ease, background 0.12s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mandala-cell :global(svg) {
    width: 100%;
    height: 100%;
    /* Subtle bloom: glow grows from the 0|0 origin toward the 3|3 full flower. */
    filter: drop-shadow(0 0 calc(var(--bloom, 0) * 7px) color-mix(in srgb, var(--el) calc(var(--bloom, 0) * 55%), transparent));
  }
  /* Matched-turn diagonal (blue == red): the symmetric mandalas, the grid's spine. */
  .mandala-cell.diag {
    background: radial-gradient(circle, color-mix(in srgb, var(--el) 20%, transparent), transparent 70%);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el) 40%, transparent);
  }
  .mandala-cell:hover {
    transform: scale(1.1);
    background: color-mix(in srgb, var(--el) 18%, transparent);
  }
  .mandala-cell:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--el) 70%, transparent);
    outline-offset: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .mandala-cell { transition: none; }
  }
  .card-empty {
    width: 100%;
    aspect-ratio: 1;
    border-radius: clamp(4px, 1cqi, 8px);
    background: rgba(255, 255, 255, 0.012);
  }
</style>
