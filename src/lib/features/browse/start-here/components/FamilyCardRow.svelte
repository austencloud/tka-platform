<!--
  FamilyCardRow — given a TnD familyId, resolve every base seed with its full
  turn grid (resolveTnDFamilyCards → SeedMatrix[]) and render the REAL
  ChoreoCardThumbnails grouped by seed, one card per rotation variety. Clicking a
  card opens it in the sequence viewer.
-->
<script lang="ts">
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { resolveTnDFamilyCards } from "$lib/features/lab/vtg-lab/services/resolve-tnd-family-cards";
  import type { SeedMatrix } from "$lib/features/lab/vtg-lab/domain/tnd-turn-patterns";
  import { getTnDElement } from "$lib/features/choreo-card/domain/tnd-element";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    familyId: string;
  }
  let { familyId }: Props = $props();

  const element = $derived(getTnDElement(familyId));

  let matrices = $state<SeedMatrix[]>([]);
  let loading = $state(true);

  $effect(() => {
    const id = familyId;
    loading = true;
    matrices = [];
    let cancelled = false;
    resolveTnDFamilyCards(id)
      .then((m) => {
        if (cancelled) return;
        matrices = m;
        loading = false;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[start-here] resolveTnDFamilyCards FAILED", id, err);
        matrices = [];
        loading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  /** Sort "blue|red" turn keys blue-major so each seed reads as a rotation ladder. */
  function turnOrder(key: string): number {
    const [b, r] = key.split("|").map(Number);
    return (b ?? 0) * 100 + (r ?? 0);
  }

  /** Filename-safe turn token for the per-variant id ("1.5|0" → "1p5-0"). */
  function safeTurn(turn: string): string {
    return turn.replace(/\|/g, "-").replace(/\./g, "p");
  }

  // Every turn variety of a seed shares the same word AND base id. The thumbnail
  // render cache keys on (word, id) only — no step content — so without a unique
  // id per variant all 49 collapse to one cached image. Give each a distinct id.
  const groups = $derived(
    matrices
      .map((m) => ({
        seedId: m.seedId,
        word: m.word,
        cards: [...m.byTurn.entries()]
          .sort((a, b) => turnOrder(a[0]) - turnOrder(b[0]))
          .map(([turn, sequence]) => ({
            turn,
            sequence: updateSequenceData(sequence, {
              id: `${sequence.id}__t_${safeTurn(turn)}`,
            }),
          })),
      }))
      .filter((g) => g.cards.length > 0)
  );

  function open(seq: SequenceData) {
    openSequenceViewer(seq, { returnPath: "/browse/gallery", returnLabel: "Browse" });
  }
</script>

<section class="family">
  <header class="head" style="--accent: {element?.accentColor ?? '#6aa0ff'}">
    <h2>{element?.name ?? familyId}</h2>
    <span class="sub">{element?.element ?? ""}</span>
  </header>

  {#if loading}
    <div class="state">Loading {element?.name ?? familyId}…</div>
  {:else if groups.length === 0}
    <div class="state">No cards for this family yet.</div>
  {:else}
    <div class="scroll">
      {#each groups as group (group.seedId)}
        <div class="seed-group">
          <h3 class="seed-title">
            {group.word}
            <span class="seed-count">{group.cards.length}</span>
          </h3>
          <div class="grid">
            {#each group.cards as card (card.turn)}
              <ChoreoCardThumbnail sequence={card.sequence} addWord onPrimaryAction={open} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .family {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
  }
  .head {
    flex: 0 0 auto;
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  .head h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--accent);
  }
  .sub {
    color: var(--theme-text-muted, #9aa6b8);
    text-transform: capitalize;
    font-size: 0.9rem;
  }
  .state {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--theme-text-muted, #9aa6b8);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    padding-bottom: 1rem;
  }
  .seed-group {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .seed-title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--theme-text, #e8edf6);
  }
  .seed-count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text-muted, #9aa6b8);
    background: color-mix(in srgb, var(--theme-text, #e8edf6) 12%, transparent);
    border-radius: 999px;
    padding: 0.05rem 0.5rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
  }
</style>
