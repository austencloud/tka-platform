<!--
  GalleryComposeBoard — the Configure board for gallery-sourced decks. Filters
  the operator's own library; the deck is every match up to the size cap. Reads/
  writes rs.galleryFilters + rs.totalCards. Built on the canonical FilterChipBase
  toggle primitive (no hand-rolled chips, no checkboxes).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { getDeckReleaserContext } from "./context/deck-releaser-context";

  const { state: rs } = getDeckReleaserContext();

  // Loaded collections (operator's library). Empty until the async load resolves
  // or when signed-out / no collections — the board still works (collection filter
  // just shows nothing to pick).
  let collections = $state<{ id: string; name: string }[]>([]);
  let collectionsReady = $state(false);

  onMount(async () => {
    try {
      const { getCollections } =
        await import("$lib/shared/library/services/collection-manager");
      const cols = await getCollections();
      collections = cols.map((c) => ({ id: c.id, name: c.name }));
    } catch {
      collections = [];
    } finally {
      collectionsReady = true;
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

  function setTotalCards(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    rs.totalCards = Math.max(1, Math.min(500, parsed));
    rs.persist();
  }

  const activeFilterCount = $derived(
    (f.collectionId ? 1 : 0) +
      (f.wordQuery?.trim() ? 1 : 0) +
      (f.period ? 1 : 0) +
      (f.loopTypes?.length ?? 0) +
      (f.levels?.length ?? 0) +
      (f.lengths?.length ?? 0)
  );

  const collectionSummary = $derived(
    f.collectionId
      ? (collections.find((collection) => collection.id === f.collectionId)
          ?.name ?? "Saved collection")
      : "Entire library"
  );
  const searchSummary = $derived(f.wordQuery?.trim() || "Any word");
  const loopTypeSummary = $derived.by(() => {
    const labels = (f.loopTypes ?? []).map(
      (id) => LOOP_TYPES.find((option) => option.id === id)?.label ?? id
    );
    return labels.length === 0
      ? "Any type"
      : labels.length <= 2
        ? labels.join(", ")
        : `${labels.length} types`;
  });
  const periodSummary = $derived(
    f.period === "quartered"
      ? "Quartered"
      : f.period === "halved"
        ? "Halved"
        : "Any period"
  );
  const levelSummary = $derived(
    !f.levels?.length
      ? "All levels"
      : f.levels.length <= 3
        ? f.levels.map((level) => `L${level}`).join(", ")
        : `${f.levels.length} levels`
  );
  const lengthSummary = $derived(
    !f.lengths?.length
      ? "Any length"
      : f.lengths.length <= 3
        ? f.lengths.map((length) => `${length}-step`).join(", ")
        : `${f.lengths.length} lengths`
  );
  const editionSummary = $derived(rs.notes.trim() || "Untitled edition");
  const propSummary = $derived(getPropTypeDisplayInfo(rs.bluePropType).label);

  function clearFilters() {
    rs.galleryFilters = {};
    rs.persist();
  }
</script>

<div class="gallery-board">
  <header class="gallery-intro">
    <div class="intro-lead">
      <span class="intro-mark" aria-hidden="true">
        <i class="fas fa-sliders"></i>
      </span>
      <div class="intro-copy">
        <span class="intro-kicker">Library draw</span>
        <h3>Shape the source pool</h3>
        <p>
          Each selection narrows the library. Unselected categories stay open.
        </p>
      </div>
    </div>

    <div class="filter-status">
      <span class="active-count" aria-live="polite">
        <strong>{activeFilterCount}</strong>
        {activeFilterCount === 1 ? "active filter" : "active filters"}
      </span>
      <FilterChipBase
        mode="action"
        size="sm"
        icon="fas fa-arrow-rotate-left"
        label="Clear all"
        disabled={activeFilterCount === 0}
        onclick={clearFilters}
      />
    </div>
  </header>

  <div class="gallery-workspace">
    <div class="filter-canvas">
      <section
        class="filter-card quick-card"
        class:is-active={!!f.wordQuery?.trim()}
      >
        <div class="card-heading">
          <div class="heading-title">
            <span class="card-icon"
              ><i class="fas fa-magnifying-glass" aria-hidden="true"></i></span
            >
            <span class="heading-copy">
              <span class="card-kicker">Deck brief</span>
              <strong>Search and size</strong>
            </span>
          </div>
          <span class="card-state">Up to {rs.totalCards} cards</span>
        </div>

        <div class="quick-fields">
          <label class="field search-field">
            <span class="field-label">Word or name</span>
            <span class="input-shell">
              <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
              <input
                id="gallery-word-query"
                name="gallery-word-query"
                class="word-input"
                type="search"
                value={f.wordQuery ?? ""}
                placeholder="Search your library"
                oninput={(e) =>
                  patch({
                    wordQuery:
                      (e.target as HTMLInputElement).value || undefined,
                  })}
              />
            </span>
          </label>

          <label class="field size-field">
            <span class="field-label">Card limit</span>
            <input
              id="gallery-card-limit"
              name="gallery-card-limit"
              class="size-input"
              type="number"
              inputmode="numeric"
              min="1"
              max="500"
              value={rs.totalCards}
              oninput={(e) =>
                setTotalCards((e.target as HTMLInputElement).value)}
            />
            <span class="field-help">1 to 500 cards</span>
          </label>
        </div>
      </section>

      <div class="gallery-filter-grid">
        <section
          class="filter-card collection-card"
          class:is-active={!!f.collectionId}
        >
          <div class="card-heading">
            <div class="heading-title">
              <span class="card-icon"
                ><i class="fas fa-folder-open" aria-hidden="true"></i></span
              >
              <span class="heading-copy">
                <span class="card-kicker">Source</span>
                <strong>Collection</strong>
              </span>
            </div>
            <span class="card-state">{collectionSummary}</span>
          </div>
          <div class="chips collection-options" aria-live="polite">
            {#if !collectionsReady}
              <span class="collection-state"
                ><i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                Loading collections</span
              >
            {:else if collections.length === 0}
              <span class="collection-state"
                >No collections yet. The full library stays in scope.</span
              >
            {:else}
              {#each collections as col (col.id)}
                <FilterChipBase
                  mode="toggle"
                  size="sm"
                  label={col.name}
                  active={f.collectionId === col.id}
                  onclick={() => pickCollection(col.id)}
                />
              {/each}
            {/if}
          </div>
        </section>

        <section
          class="filter-card loop-card"
          class:is-active={!!f.loopTypes?.length}
        >
          <div class="card-heading">
            <div class="heading-title">
              <span class="card-icon"
                ><i class="fas fa-arrows-rotate" aria-hidden="true"></i></span
              >
              <span class="heading-copy">
                <span class="card-kicker">Motion</span>
                <strong>Loop type</strong>
              </span>
            </div>
            <span class="card-state">{loopTypeSummary}</span>
          </div>
          <div class="chips">
            {#each LOOP_TYPES as lt (lt.id)}
              <FilterChipBase
                mode="toggle"
                size="sm"
                label={lt.label}
                active={(f.loopTypes ?? []).includes(lt.id)}
                onclick={() =>
                  patch({ loopTypes: toggleIn(f.loopTypes, lt.id) })}
              />
            {/each}
          </div>
        </section>

        <section class="filter-card period-card" class:is-active={!!f.period}>
          <div class="card-heading">
            <div class="heading-title">
              <span class="card-icon"
                ><i class="fas fa-chart-pie" aria-hidden="true"></i></span
              >
              <span class="heading-copy">
                <span class="card-kicker">Timing</span>
                <strong>Period</strong>
              </span>
            </div>
            <span class="card-state">{periodSummary}</span>
          </div>
          <div class="chips">
            <FilterChipBase
              mode="toggle"
              size="sm"
              label="Quartered"
              active={f.period === "quartered"}
              onclick={() => pickPeriod("quartered")}
            />
            <FilterChipBase
              mode="toggle"
              size="sm"
              label="Halved"
              active={f.period === "halved"}
              onclick={() => pickPeriod("halved")}
            />
          </div>
        </section>

        <section
          class="filter-card level-card"
          class:is-active={!!f.levels?.length}
        >
          <div class="card-heading">
            <div class="heading-title">
              <span class="card-icon"
                ><i class="fas fa-signal" aria-hidden="true"></i></span
              >
              <span class="heading-copy">
                <span class="card-kicker">Difficulty</span>
                <strong>Level</strong>
              </span>
            </div>
            <span class="card-state">{levelSummary}</span>
          </div>
          <div class="chips">
            {#each LEVELS as lvl (lvl)}
              <FilterChipBase
                mode="toggle"
                size="sm"
                label={`L${lvl}`}
                active={(f.levels ?? []).includes(lvl)}
                onclick={() => patch({ levels: toggleIn(f.levels, lvl) })}
              />
            {/each}
          </div>
        </section>

        <section
          class="filter-card length-card"
          class:is-active={!!f.lengths?.length}
        >
          <div class="card-heading">
            <div class="heading-title">
              <span class="card-icon"
                ><i class="fas fa-ruler-horizontal" aria-hidden="true"
                ></i></span
              >
              <span class="heading-copy">
                <span class="card-kicker">Sequence</span>
                <strong>Length</strong>
              </span>
            </div>
            <span class="card-state">{lengthSummary}</span>
          </div>
          <div class="chips">
            {#each LENGTHS as len (len)}
              <FilterChipBase
                mode="toggle"
                size="sm"
                label={`${len}-step`}
                active={(f.lengths ?? []).includes(len)}
                onclick={() => patch({ lengths: toggleIn(f.lengths, len) })}
              />
            {/each}
          </div>
        </section>
      </div>
    </div>

    <aside class="recipe-panel" aria-labelledby="gallery-recipe-heading">
      <div class="recipe-heading">
        <span class="recipe-icon" aria-hidden="true">
          <i class="fas fa-layer-group"></i>
        </span>
        <span>
          <span class="recipe-kicker">Live recipe</span>
          <h3 id="gallery-recipe-heading">Deck at a glance</h3>
        </span>
      </div>

      <div class="deck-visual" aria-hidden="true">
        <span class="deck-card deck-card-back"></span>
        <span class="deck-card deck-card-middle"></span>
        <span class="deck-card deck-card-front">
          <i class="fas fa-wand-magic-sparkles"></i>
          <span>Choreo Cards</span>
        </span>
        <span class="target-count">
          <strong>{rs.totalCards}</strong>
          <span>card target</span>
        </span>
      </div>

      <dl class="recipe-list">
        <div>
          <dt>Edition</dt>
          <dd>{editionSummary}</dd>
        </div>
        <div>
          <dt>Collection</dt>
          <dd>{collectionSummary}</dd>
        </div>
        <div>
          <dt>Search</dt>
          <dd>{searchSummary}</dd>
        </div>
        <div>
          <dt>Motion</dt>
          <dd>{loopTypeSummary}</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{periodSummary}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{levelSummary}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{lengthSummary}</dd>
        </div>
        <div>
          <dt>Prop</dt>
          <dd>{propSummary}</dd>
        </div>
      </dl>

      <div class="draw-order">
        <span class="order-index">01</span>
        <span>
          <small>Draw order</small>
          <strong>Newest matches first</strong>
        </span>
      </div>
    </aside>
  </div>
</div>

<style>
  .gallery-board {
    display: flex;
    flex-direction: column;
    gap: clamp(14px, 1.25cqw, 24px);
    width: 100%;
    min-width: 0;
  }

  .gallery-intro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(16px, 2cqw, 32px);
    padding: clamp(18px, 1.8cqw, 30px);
    background:
      linear-gradient(
        115deg,
        color-mix(in srgb, var(--theme-accent, #8b5cf6) 12%, transparent),
        transparent 48%
      ),
      var(--theme-panel-bg, rgba(18, 18, 28, 0.96));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 18px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }

  .intro-lead {
    display: flex;
    align-items: center;
    gap: clamp(12px, 1.2cqw, 20px);
    min-width: 0;
  }

  .intro-mark {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: clamp(44px, 4cqw, 58px);
    height: clamp(44px, 4cqw, 58px);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 18%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 32%, transparent);
    border-radius: 15px;
    color: var(--theme-accent, #8b5cf6);
    font-size: 18px;
  }

  .intro-copy {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .intro-kicker,
  .card-kicker {
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .intro-copy h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: clamp(20px, 1.55cqw, 30px);
    font-weight: 800;
    letter-spacing: -0.025em;
  }

  .intro-copy p {
    max-width: 56rem;
    margin: 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
  }

  .filter-status {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
  }

  .active-count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    box-sizing: border-box;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
  }

  .active-count strong {
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }

  .gallery-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(14px, 1.25cqw, 24px);
    align-items: stretch;
    min-width: 0;
  }

  .filter-canvas {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 1.1cqw, 22px);
    min-width: 0;
  }

  .gallery-filter-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: clamp(12px, 1.1cqw, 22px);
    width: 100%;
  }

  .filter-card {
    display: flex;
    flex-direction: column;
    gap: clamp(14px, 1.2cqw, 22px);
    min-width: 0;
    min-height: 9.5rem;
    padding: clamp(16px, 1.45cqw, 26px);
    box-sizing: border-box;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--theme-accent, #8b5cf6) 4%, transparent),
        transparent 46%
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease;
  }

  .filter-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.055));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
  }

  .filter-card.is-active {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 46%,
      var(--theme-stroke, rgba(255, 255, 255, 0.1))
    );
    box-shadow: inset 3px 0 0
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 78%, transparent);
  }

  .quick-card {
    grid-column: span 12;
    min-height: 0;
  }

  .collection-card,
  .loop-card,
  .period-card,
  .level-card,
  .length-card {
    grid-column: span 12;
  }

  .card-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 11px;
  }

  .heading-title {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .heading-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .card-heading strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    line-height: 1.35;
  }

  .card-state {
    flex: 0 1 auto;
    max-width: 46%;
    overflow: hidden;
    padding: 6px 9px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(18, 18, 28, 0.96)) 72%,
      transparent
    );
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.09));
    border-radius: 999px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-card.is-active .card-state {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 14%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 30%,
      transparent
    );
    color: var(--theme-text, #fff);
  }

  .card-icon {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 13%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 26%, transparent);
    border-radius: 11px;
    color: var(--theme-accent, #8b5cf6);
  }

  .quick-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(9rem, 0.22fr);
    gap: clamp(14px, 1.4cqw, 24px);
    align-items: end;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .field-label,
  .field-help {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .field-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .field-help {
    min-height: 1.35em;
    line-height: 1.35;
  }

  .input-shell {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-shell > i {
    position: absolute;
    left: 14px;
    z-index: 1;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    pointer-events: none;
  }

  .word-input,
  .size-input {
    width: 100%;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 11px 14px;
    box-sizing: border-box;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    outline: none;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease;
  }

  .word-input {
    padding-inline-start: 40px;
  }

  .size-input {
    font-variant-numeric: tabular-nums;
  }

  .word-input:hover,
  .size-input:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
  }

  .word-input:focus,
  .size-input:focus {
    border-color: var(--theme-accent, #8b5cf6);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 20%, transparent);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-content: flex-start;
  }

  .collection-options {
    min-height: var(--min-touch-target, 44px);
  }

  .collection-state {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    line-height: 1.4;
  }

  .recipe-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 1.35cqw, 24px);
    min-width: 0;
    padding: clamp(18px, 1.55cqw, 28px);
    box-sizing: border-box;
    background:
      radial-gradient(
        circle at 82% 14%,
        color-mix(in srgb, var(--theme-accent, #8b5cf6) 17%, transparent),
        transparent 30%
      ),
      linear-gradient(
        155deg,
        color-mix(in srgb, var(--theme-accent, #8b5cf6) 7%, transparent),
        transparent 48%
      ),
      var(--theme-panel-bg, rgba(18, 18, 28, 0.96));
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, #8b5cf6) 22%,
        var(--theme-stroke, rgba(255, 255, 255, 0.1))
      );
    border-radius: 18px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .recipe-heading {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .recipe-heading > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .recipe-icon {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    background: var(--theme-accent, #8b5cf6);
    border-radius: 13px;
    color: #fff;
    box-shadow: 0 12px 28px
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 24%, transparent);
  }

  .recipe-kicker {
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .recipe-heading h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: clamp(18px, 1.25cqw, 24px);
    line-height: 1.2;
  }

  .deck-visual {
    position: relative;
    min-height: clamp(12rem, 17cqw, 17rem);
    overflow: hidden;
    background:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      color-mix(
        in srgb,
        var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 86%,
        transparent
      );
    background-size: 24px 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
  }

  .deck-card {
    position: absolute;
    top: 50%;
    left: 42%;
    width: clamp(5.2rem, 6.5cqw, 7.5rem);
    aspect-ratio: 5 / 7;
    border-radius: 12px;
    transform-origin: center;
  }

  .deck-card-back {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 18%,
      var(--theme-card-bg, #171725)
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 42%, transparent);
    transform: translate(-72%, -48%) rotate(-11deg);
  }

  .deck-card-middle {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 11%,
      var(--theme-panel-bg, #11111a)
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 34%, transparent);
    transform: translate(-52%, -50%) rotate(-3deg);
  }

  .deck-card-front {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--theme-accent, #8b5cf6) 28%, transparent),
        transparent 58%
      ),
      var(--theme-card-bg, #191927);
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 56%, transparent);
    color: var(--theme-text, #fff);
    transform: translate(-32%, -51%) rotate(5deg);
    box-shadow: 0 22px 42px rgba(0, 0, 0, 0.34);
  }

  .deck-card-front i {
    color: var(--theme-accent, #8b5cf6);
    font-size: clamp(18px, 2cqw, 28px);
  }

  .deck-card-front span {
    max-width: 70%;
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
  }

  .target-count {
    position: absolute;
    right: clamp(12px, 1.2cqw, 20px);
    bottom: clamp(12px, 1.2cqw, 20px);
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-width: 6rem;
    padding: 12px 14px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #11111a) 90%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 42%, transparent);
    border-radius: 13px;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
  }

  .target-count strong {
    color: var(--theme-text, #fff);
    font-size: clamp(26px, 2.25cqw, 38px);
    font-variant-numeric: tabular-nums;
    line-height: 0.95;
  }

  .target-count span {
    margin-top: 5px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    white-space: nowrap;
  }

  .recipe-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 clamp(18px, 2cqw, 32px);
    margin: 0;
  }

  .recipe-list > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    padding: 11px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .recipe-list dt,
  .recipe-list dd {
    margin: 0;
  }

  .recipe-list dt {
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .recipe-list dd {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .draw-order {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: auto;
    padding: 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 9%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 20%, transparent);
    border-radius: 13px;
  }

  .order-index {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 18%,
      transparent
    );
    border-radius: 11px;
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-min, 14px);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .draw-order > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .draw-order small {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .draw-order strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }

  @container configure (min-width: 52rem) {
    .collection-card,
    .loop-card {
      grid-column: span 12;
    }

    .period-card,
    .level-card {
      grid-column: span 6;
    }

    .length-card {
      grid-column: span 12;
    }

    .recipe-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container configure (min-width: 74rem) {
    .gallery-workspace {
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.31fr);
    }

    .collection-card {
      grid-column: span 7;
    }

    .loop-card {
      grid-column: span 5;
    }

    .period-card {
      grid-column: span 3;
    }

    .level-card {
      grid-column: span 4;
    }

    .length-card {
      grid-column: span 5;
    }

    .recipe-panel {
      min-height: 100%;
    }

    .recipe-list {
      grid-template-columns: 1fr;
    }
  }

  @container configure (max-width: 40rem) {
    .gallery-intro {
      align-items: flex-start;
      flex-direction: column;
    }

    .filter-status {
      width: 100%;
      justify-content: space-between;
    }

    .quick-fields {
      grid-template-columns: 1fr;
    }

    .intro-lead {
      align-items: flex-start;
    }

    .card-heading {
      align-items: flex-start;
    }

    .card-state {
      max-width: 42%;
    }

    .recipe-list {
      grid-template-columns: 1fr;
    }

    .active-count {
      white-space: normal;
    }
  }

  @container configure (max-width: 24rem) {
    .filter-status {
      align-items: stretch;
      flex-direction: column;
    }

    .active-count {
      justify-content: center;
    }

    .filter-card,
    .gallery-intro,
    .recipe-panel {
      border-radius: 14px;
    }
  }

  @container configure (min-width: 160rem) {
    .gallery-intro,
    .filter-card,
    .recipe-panel {
      border-radius: 24px;
    }

    .gallery-intro {
      min-height: 11rem;
      padding: 36px;
      box-sizing: border-box;
    }

    .intro-copy h3 {
      font-size: 2.25rem;
    }

    .filter-card {
      justify-content: space-between;
      min-height: 15.5rem;
      padding: 32px;
    }

    .quick-card {
      min-height: 13rem;
    }

    .gallery-workspace {
      grid-template-columns: minmax(0, 1fr) minmax(31rem, 0.27fr);
      gap: 28px;
    }

    .recipe-panel {
      min-height: 48rem;
      padding: 32px;
    }

    .deck-visual {
      min-height: 21rem;
    }

    .recipe-list > div {
      padding-block: 15px;
    }

    .card-icon {
      width: 52px;
      height: 52px;
      border-radius: 15px;
    }

    .chips {
      gap: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-card,
    .word-input,
    .size-input {
      transition: none;
    }
  }
</style>
