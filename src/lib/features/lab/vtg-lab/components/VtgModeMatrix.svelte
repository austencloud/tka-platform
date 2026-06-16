<script lang="ts">
  import TurnMatrixGrid from "$lib/features/choreo-card/components/TurnMatrixGrid.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import CardInspectModal from "$lib/features/choreo-card/components/CardInspectModal.svelte";
  import { resolveTnDFamilyCards } from "../services/resolve-tnd-family-cards";
  import type { SeedMatrix } from "../domain/tnd-turn-patterns";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    /** TnD family id, e.g. "split-opp". */
    familyId: string;
  }
  const { familyId }: Props = $props();

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
  <div class="seed-grid">
    {#each seeds as seed (seed.seedId)}
    <section class="seed-block">
      <h3 class="seed-title">{displayWord(seed.seedId)}</h3>
      <TurnMatrixGrid ariaLabel="{displayWord(seed.seedId)} turn matrix">
        {#snippet cell(blue: number, red: number)}
          {@const seq = seed.byTurn.get(turnKey(blue, red))}
          {#if seq}
            <button
              type="button"
              class="mandala-cell"
              aria-label="{seed.word} {blue}|{red} — expand card"
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
  /* Lay seed matrices side by side on wide screens; wrap/stack when narrow. */
  .seed-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem 1rem;
    align-items: start;
  }
  .seed-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .seed-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-secondary, #888);
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
  }
  .mandala-cell:hover {
    transform: scale(1.08);
    background: rgba(183, 99, 205, 0.12);
  }
  .mandala-cell:focus-visible {
    outline: 2px solid rgba(183, 99, 205, 0.7);
    outline-offset: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .mandala-cell { transition: none; }
  }
  .card-empty {
    width: 100%;
    aspect-ratio: 1;
    border-radius: clamp(4px, 1cqi, 8px);
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.03);
  }
</style>
