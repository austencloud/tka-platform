<!--
  GalleryComposeBoard — the Configure board for gallery-sourced decks. Filters
  the operator's own library; the deck is every match up to the size cap. Reads/
  writes rs.galleryFilters + rs.totalCards. Built on the canonical FilterChipBase
  toggle primitive (no hand-rolled chips, no checkboxes).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { releaserState as rs } from "./deck-releaser-state.svelte";

  // Loaded collections (operator's library). Empty until the async load resolves
  // or when signed-out / no collections — the board still works (collection filter
  // just shows nothing to pick).
  let collections = $state<{ id: string; name: string }[]>([]);

  onMount(async () => {
    try {
      const { getCollections } = await import("$lib/shared/library/services/collection-manager");
      const cols = await getCollections();
      collections = cols.map((c) => ({ id: c.id, name: c.name }));
    } catch {
      collections = [];
    }
  });

  // Static axes. Loop types + lengths mirror the LOOP board's vocabulary.
  const LOOP_TYPES: { id: string; label: string }[] = [
    { id: "rotated", label: "Rotated" },
    { id: "mirrored", label: "Mirrored" },
    { id: "swapped", label: "Swapped" },
    { id: "rotated_mirrored", label: "Rot+Mir" },
  ];
  const LENGTHS = [4, 8, 12, 16];
  const LEVELS = [1, 2, 3, 4, 5, 6];

  // --- mutators (all persist so a refresh keeps the filter) ---
  function patch(next: Partial<typeof rs.galleryFilters>) {
    rs.galleryFilters = { ...rs.galleryFilters, ...next };
    rs.persist();
  }
  function toggleIn<T>(list: T[] | undefined, value: T): T[] {
    const set = new Set(list ?? []);
    set.has(value) ? set.delete(value) : set.add(value);
    return [...set];
  }
  const f = $derived(rs.galleryFilters);

  function pickCollection(id: string) {
    patch({ collectionId: f.collectionId === id ? undefined : id });
  }
  function pickPeriod(p: "halved" | "quartered") {
    patch({ period: f.period === p ? undefined : p });
  }
</script>

<div class="gallery-board">
  <p class="hint">Draw a deck from your library. Filters narrow the pool; the deck is every match, newest first, up to the size.</p>

  <label class="field">
    <span class="field-label">Word / name</span>
    <input
      class="word-input"
      type="text"
      value={f.wordQuery ?? ""}
      placeholder="Filter by word…"
      oninput={(e) => patch({ wordQuery: (e.target as HTMLInputElement).value || undefined })}
    />
  </label>

  <label class="field">
    <span class="field-label">Deck size</span>
    <input
      class="size-input"
      type="number"
      min="1"
      max="500"
      value={rs.totalCards}
      oninput={(e) => { const n = parseInt((e.target as HTMLInputElement).value, 10); if (!Number.isNaN(n)) { rs.totalCards = Math.max(1, Math.min(500, n)); rs.persist(); } }}
    />
  </label>

  {#if collections.length > 0}
    <div class="axis">
      <span class="axis-label">Collection</span>
      <div class="chips">
        {#each collections as col (col.id)}
          <FilterChipBase mode="toggle" size="sm" label={col.name} active={f.collectionId === col.id} onclick={() => pickCollection(col.id)} />
        {/each}
      </div>
    </div>
  {/if}

  <div class="axis">
    <span class="axis-label">Loop type</span>
    <div class="chips">
      {#each LOOP_TYPES as lt (lt.id)}
        <FilterChipBase mode="toggle" size="sm" label={lt.label} active={(f.loopTypes ?? []).includes(lt.id)} onclick={() => patch({ loopTypes: toggleIn(f.loopTypes, lt.id) })} />
      {/each}
    </div>
  </div>

  <div class="axis">
    <span class="axis-label">Period</span>
    <div class="chips">
      <FilterChipBase mode="toggle" size="sm" label="Quartered" active={f.period === "quartered"} onclick={() => pickPeriod("quartered")} />
      <FilterChipBase mode="toggle" size="sm" label="Halved" active={f.period === "halved"} onclick={() => pickPeriod("halved")} />
    </div>
  </div>

  <div class="axis">
    <span class="axis-label">Level</span>
    <div class="chips">
      {#each LEVELS as lvl (lvl)}
        <FilterChipBase mode="toggle" size="sm" label={`L${lvl}`} active={(f.levels ?? []).includes(lvl)} onclick={() => patch({ levels: toggleIn(f.levels, lvl) })} />
      {/each}
    </div>
  </div>

  <div class="axis">
    <span class="axis-label">Length</span>
    <div class="chips">
      {#each LENGTHS as len (len)}
        <FilterChipBase mode="toggle" size="sm" label={`${len}-step`} active={(f.lengths ?? []).includes(len)} onclick={() => patch({ lengths: toggleIn(f.lengths, len) })} />
      {/each}
    </div>
  </div>
</div>

<style>
  .gallery-board {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 760px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 320px;
  }
  .field-label,
  .axis-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .word-input,
  .size-input {
    padding: 10px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    outline: none;
  }
  .word-input:focus,
  .size-input:focus { border-color: var(--theme-accent, #8b5cf6); }
  .size-input { max-width: 120px; }
  .axis {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
