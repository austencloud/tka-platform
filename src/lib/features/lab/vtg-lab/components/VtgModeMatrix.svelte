<script lang="ts">
  import TurnMatrixGrid from "$lib/features/choreo-card/components/TurnMatrixGrid.svelte";
  import LazyCardCell from "./LazyCardCell.svelte";
  import { resolveTnDFamilyCards } from "../services/resolve-tnd-family-cards";
  import type { SeedMatrix } from "../domain/tnd-turn-patterns";

  interface Props {
    /** TnD family id, e.g. "split-opp". */
    familyId: string;
  }
  const { familyId }: Props = $props();

  let seeds = $state<SeedMatrix[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

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
</script>

{#if loading}
  <div class="status" role="status">Loading sequences…</div>
{:else if error}
  <div class="status error" role="alert"><i class="fas fa-triangle-exclamation"></i> {error}</div>
{:else if seeds.length === 0}
  <div class="status">No sequences for this family.</div>
{:else}
  {#each seeds as seed (seed.seedId)}
    <section class="seed-block">
      <h3 class="seed-title">{seed.word}</h3>
      <TurnMatrixGrid ariaLabel="{seed.word} turn matrix">
        {#snippet cell(blue: number, red: number)}
          {@const seq = seed.byTurn.get(turnKey(blue, red))}
          {#if seq}
            <LazyCardCell sequence={seq} notes={seed.footer.center ?? ""} />
          {:else}
            <div class="card-empty" aria-label="No sequence for {blue}|{red}"></div>
          {/if}
        {/snippet}
      </TurnMatrixGrid>
    </section>
  {/each}
{/if}

<style>
  .status {
    padding: 2rem;
    text-align: center;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
  }
  .status.error { color: #fbbf24; }
  .seed-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .seed-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-secondary, #888);
  }
  .card-empty {
    width: 100%;
    aspect-ratio: 5 / 7;
    border-radius: clamp(4px, 1cqi, 8px);
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.03);
  }
</style>
