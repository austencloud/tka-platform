<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import AtlasRegionDiagram from "./AtlasRegionDiagram.svelte";

  type AtlasCategory = {
    key: string;
    label: string;
    sectionSlug: string;
    countLabel: string;
  };

  type AtlasRegion = {
    key: string;
    label: string;
    summary: string;
    description: string;
    sectionSlug: string;
    countLabel: string;
    categories: AtlasCategory[];
  };

  type LetterTypeSummary = {
    number: string;
    label: string;
    countLabel: string;
  };

  let {
    regions,
    letterTypes,
    totalTerms,
    query = $bindable(""),
    showRegions = true,
    onOpenRegion,
    onOpenCategory,
    onBrowseAll,
  }: {
    regions: AtlasRegion[];
    letterTypes: LetterTypeSummary[];
    totalTerms: number;
    query?: string;
    showRegions?: boolean;
    onOpenRegion: (key: string) => void;
    onOpenCategory: (key: string) => void;
    onBrowseAll: () => void;
  } = $props();

  let selectedRegionKey = $state(
    regions.find((region) => region.key === "letters")?.key ??
      regions[0]?.key ??
      ""
  );

  const selectedRegion = $derived(
    regions.find((region) => region.key === selectedRegionKey) ?? regions[0]
  );
</script>

<section class="atlas-overview" aria-labelledby="kinetic-atlas-title">
  <header class="atlas-hero">
    <div class="atlas-intro">
      <span class="atlas-kicker">One visual knowledge system</span>
      <h1 id="kinetic-atlas-title">The Kinetic Atlas</h1>
      <p>
        Explore how space, motion, letters, notation, patterns, and technique
        connect. Definitions stay underneath the experience instead of becoming
        the experience.
      </p>
    </div>

    <div class="atlas-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input
        data-glossary-search
        name="atlas-search"
        type="search"
        placeholder="Find a letter, motion, position, or pattern"
        aria-label="Find anything in the Kinetic Atlas"
        autocomplete="off"
        bind:value={query}
      />
      {#if query.trim()}
        <button
          type="button"
          class="atlas-search-clear"
          aria-label="Clear Atlas search"
          onclick={() => (query = "")}
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      {/if}
      <span class="atlas-search-hint"
        >Press <kbd>/</kbd> to search {totalTerms} terms</span
      >
    </div>
  </header>

  {#if showRegions && selectedRegion}
    <div class="atlas-workspace">
      <section class="region-board" aria-labelledby="atlas-regions-title">
        <div class="region-board-head">
          <div>
            <span class="panel-kicker">Atlas overview</span>
            <h2 id="atlas-regions-title">Choose a region</h2>
          </div>
          <span>{regions.length} connected sub-atlases</span>
        </div>

        <div class="region-grid">
          {#each regions as region (region.key)}
            <button
              id={region.sectionSlug}
              type="button"
              class={`region-button region-${region.key}`}
              aria-pressed={selectedRegionKey === region.key}
              onclick={() => (selectedRegionKey = region.key)}
            >
              <span class="region-visual">
                <AtlasRegionDiagram region={region.key} />
              </span>
              <span class="region-title-row">
                <strong>{region.label}</strong>
                <span>{region.countLabel}</span>
              </span>
              <span class="region-summary">{region.summary}</span>
            </button>
          {/each}
        </div>
      </section>

      <section
        class={`region-detail region-${selectedRegion.key}`}
        aria-labelledby="selected-region-title"
        aria-live="polite"
      >
        <Crossfade key={selectedRegion.key} duration={DURATION.normal}>
          <div class="region-detail-inner">
            <header class="region-detail-head">
              <div>
                <span class="panel-kicker">Atlas / {selectedRegion.label}</span>
                <h2 id="selected-region-title">{selectedRegion.label} Atlas</h2>
                <p>{selectedRegion.description}</p>
              </div>
              <span class="region-count">{selectedRegion.countLabel}</span>
            </header>

            <div class="region-detail-body">
              {#if selectedRegion.key === "letters"}
                <div class="letter-family-preview">
                  <span class="detail-label">Six motion families</span>
                  <div class="letter-type-grid">
                    {#each letterTypes as type (type.number)}
                      <div class="letter-type-item">
                        <strong>{type.label}</strong>
                        <span>{type.countLabel}</span>
                      </div>
                    {/each}
                  </div>
                  <p class="detail-note">
                    The Letter Atlas carries the actual pictographs. Pick a
                    letter there to inspect its grid context, valid variants,
                    edits, and learning-deck matches.
                  </p>
                </div>
              {:else}
                <div class="region-contents">
                  <span class="detail-label">What lives here</span>
                  <div class="category-links">
                    {#each selectedRegion.categories as category (category.key)}
                      <a
                        href={`#${category.sectionSlug}`}
                        onclick={(event) => {
                          event.preventDefault();
                          onOpenCategory(category.key);
                        }}
                      >
                        <span>
                          <strong>{category.label}</strong>
                          <small>{category.countLabel}</small>
                        </span>
                        <i class="fa-solid fa-arrow-right" aria-hidden="true"
                        ></i>
                      </a>
                    {/each}
                  </div>
                  <p class="detail-note">
                    Open the region to compare connected terms without
                    flattening them into one alphabetized list.
                  </p>
                </div>
              {/if}

              <div class="region-actions">
                <button type="button" class="all-terms" onclick={onBrowseAll}>
                  Browse all {totalTerms} terms
                </button>
                <a
                  class="open-region"
                  href={`#${selectedRegion.sectionSlug}`}
                  onclick={(event) => {
                    event.preventDefault();
                    onOpenRegion(selectedRegion.key);
                  }}
                >
                  Open {selectedRegion.label} Atlas
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </a>
              </div>
            </div>
          </div>
        </Crossfade>
      </section>
    </div>
  {/if}
</section>

<style>
  .atlas-overview {
    --atlas-text: var(--theme-text, oklch(0.96 0.01 270));
    --atlas-muted: var(--theme-text-secondary, oklch(0.68 0.02 270));
    --atlas-accent: var(--theme-accent, oklch(0.72 0.14 275));
    --atlas-panel: var(--theme-panel-bg, oklch(0.16 0.018 270 / 0.92));
    --atlas-card: var(--theme-card-bg, oklch(0.2 0.025 272 / 0.78));
    --atlas-stroke: var(--theme-stroke, oklch(0.52 0.04 270 / 0.22));
    --atlas-stroke-strong: var(
      --theme-stroke-strong,
      oklch(0.68 0.08 273 / 0.48)
    );
    container-type: inline-size;
    padding-top: 1rem;
  }

  .atlas-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(20rem, 0.75fr);
    align-items: end;
    gap: clamp(2rem, 4cqi, 5rem);
    margin-bottom: clamp(1.75rem, 3cqi, 3rem);
  }

  .atlas-kicker,
  .panel-kicker,
  .detail-label {
    display: block;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 760;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: color-mix(in oklch, var(--atlas-accent) 78%, var(--atlas-text));
  }

  .atlas-intro h1 {
    margin: 0.4rem 0 0.65rem;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings:
      "opsz" 144,
      "wght" 700,
      "SOFT" 0,
      "WONK" 1;
    font-size: clamp(3rem, 2.35rem + 2.1cqi, 5rem);
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--atlas-text);
  }

  .atlas-intro p {
    max-inline-size: 49rem;
    margin: 0;
    font-size: clamp(1rem, 0.94rem + 0.2cqi, 1.18rem);
    line-height: 1.65;
    text-wrap: pretty;
    color: var(--atlas-muted);
  }

  .atlas-search {
    position: relative;
    align-self: end;
    padding-bottom: 1.45rem;
  }

  .atlas-search > i {
    position: absolute;
    top: 1rem;
    left: 1rem;
    color: var(--atlas-muted);
    pointer-events: none;
  }

  .atlas-search input {
    width: 100%;
    min-height: 52px;
    padding: 0.7rem 3rem;
    font: inherit;
    font-size: 1rem;
    color: var(--atlas-text);
    background: var(--atlas-panel);
    border: 1px solid var(--atlas-stroke-strong);
    border-radius: 999px;
    outline: none;
    box-shadow: 0 14px 36px oklch(0.05 0.03 275 / 0.24);
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .atlas-search input::placeholder {
    color: color-mix(in oklch, var(--atlas-muted) 70%, transparent);
  }

  .atlas-search input:focus-visible {
    border-color: var(--atlas-accent);
    box-shadow:
      0 0 0 3px color-mix(in oklch, var(--atlas-accent) 25%, transparent),
      0 14px 36px oklch(0.05 0.03 275 / 0.24);
  }

  .atlas-search input::-webkit-search-cancel-button {
    appearance: none;
  }

  .atlas-search-clear {
    all: unset;
    box-sizing: border-box;
    position: absolute;
    top: 0.25rem;
    right: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--atlas-muted);
    cursor: pointer;
  }

  .atlas-search-clear:focus-visible {
    outline: 2px solid var(--atlas-accent);
    outline-offset: -4px;
  }

  .atlas-search-hint {
    position: absolute;
    right: 1rem;
    bottom: 0;
    color: var(--atlas-muted);
    font-size: var(--font-size-compact, 0.75rem);
  }

  kbd {
    font: inherit;
    color: var(--atlas-text);
  }

  .atlas-workspace {
    display: grid;
    grid-template-columns: minmax(26rem, 0.9fr) minmax(34rem, 1.35fr);
    gap: clamp(1rem, 1.7cqi, 1.75rem);
    align-items: stretch;
  }

  .region-board,
  .region-detail {
    min-width: 0;
    border: 1px solid var(--atlas-stroke);
    border-radius: var(--radius-xl, 1.5rem);
    background: var(--atlas-panel);
    box-shadow: 0 22px 60px oklch(0.04 0.03 275 / 0.22);
  }

  .region-board {
    padding: clamp(1rem, 1.4cqi, 1.4rem);
  }

  .region-board-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.15rem 0.25rem 1rem;
  }

  .region-board-head h2 {
    margin: 0.2rem 0 0;
    font-size: 1.25rem;
    color: var(--atlas-text);
  }

  .region-board-head > span {
    color: var(--atlas-muted);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .region-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }

  .region-button {
    --atlas-region-accent: var(--atlas-accent);
    position: relative;
    min-width: 0;
    min-height: 172px;
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    color: var(--atlas-text);
    background: var(--atlas-card);
    border: 1px solid var(--atlas-stroke);
    border-radius: var(--radius-lg, 1rem);
    cursor: pointer;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .region-space {
    --atlas-region-accent: var(--prop-blue, oklch(0.68 0.17 250));
  }

  .region-motion {
    --atlas-region-accent: var(--semantic-info, oklch(0.76 0.13 205));
  }

  .region-letters {
    --atlas-region-accent: var(--atlas-accent);
  }

  .region-notation {
    --atlas-region-accent: oklch(0.81 0.15 83);
  }

  .region-patterns {
    --atlas-region-accent: var(--semantic-success, oklch(0.74 0.17 155));
  }

  .region-foundation {
    --atlas-region-accent: oklch(0.72 0.17 42);
  }

  .region-button:hover {
    transform: translateY(-2px);
    border-color: var(--atlas-stroke-strong);
  }

  .region-button[aria-pressed="true"] {
    border-color: var(--atlas-region-accent);
    background: color-mix(
      in oklch,
      var(--atlas-region-accent) 12%,
      var(--atlas-card)
    );
    box-shadow: 0 0 0 2px
      color-mix(in oklch, var(--atlas-region-accent) 22%, transparent);
  }

  .region-button:focus-visible,
  .category-links a:focus-visible,
  .open-region:focus-visible,
  .all-terms:focus-visible {
    outline: 2px solid var(--atlas-region-accent, var(--atlas-accent));
    outline-offset: 2px;
  }

  .region-visual {
    height: 82px;
    margin-bottom: 0.65rem;
  }

  .region-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .region-title-row strong {
    min-width: 0;
    font-size: var(--font-size-min, 0.875rem);
  }

  .region-title-row span {
    flex-shrink: 0;
    color: var(--atlas-muted);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .region-summary {
    margin-top: 0.2rem;
    overflow: hidden;
    color: var(--atlas-muted);
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .region-detail {
    --atlas-region-accent: var(--atlas-accent);
    min-height: 655px;
    overflow: hidden;
  }

  .region-detail-inner {
    min-height: 655px;
    display: flex;
    flex-direction: column;
  }

  .region-detail-head {
    padding: clamp(1.5rem, 2.2cqi, 2.25rem);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1.5rem;
    align-items: end;
    background: radial-gradient(
      circle at 92% 0%,
      color-mix(in oklch, var(--atlas-region-accent) 18%, transparent),
      transparent 42%
    );
    border-bottom: 1px solid var(--atlas-stroke);
  }

  .region-detail-head h2 {
    margin: 0.3rem 0 0.55rem;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-size: clamp(2rem, 1.65rem + 1.15cqi, 3.15rem);
    line-height: 1;
    color: var(--atlas-text);
  }

  .region-detail-head p {
    max-inline-size: 47rem;
    margin: 0;
    color: var(--atlas-muted);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.6;
    text-wrap: pretty;
  }

  .region-count {
    min-width: 8.5rem;
    padding: 0.7rem 0.9rem;
    color: var(--atlas-text);
    background: var(--atlas-card);
    border: 1px solid var(--atlas-stroke);
    border-radius: var(--radius-md, 0.75rem);
    text-align: center;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .region-detail-body {
    flex: 1;
    padding: clamp(1.3rem, 2cqi, 2rem);
    display: flex;
    flex-direction: column;
  }

  .letter-family-preview,
  .region-contents {
    flex: 1;
  }

  .letter-type-grid {
    margin-top: 0.8rem;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .letter-type-item {
    min-height: 78px;
    padding: 0.85rem;
    border: 1px solid var(--atlas-stroke);
    border-radius: var(--radius-md, 0.75rem);
    background: var(--atlas-card);
  }

  .letter-type-item strong,
  .letter-type-item span {
    display: block;
  }

  .letter-type-item strong {
    color: var(--atlas-text);
    font-size: var(--font-size-min, 0.875rem);
  }

  .letter-type-item span {
    margin-top: 0.3rem;
    color: var(--atlas-muted);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .category-links {
    margin-top: 0.8rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .category-links a {
    min-height: 84px;
    padding: 0.85rem 0.95rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--atlas-text);
    text-decoration: none;
    background: var(--atlas-card);
    border: 1px solid var(--atlas-stroke);
    border-radius: var(--radius-md, 0.75rem);
    transition:
      border-color 160ms ease,
      background 160ms ease;
  }

  .category-links a:hover {
    border-color: var(--atlas-region-accent);
    background: color-mix(
      in oklch,
      var(--atlas-region-accent) 8%,
      var(--atlas-card)
    );
  }

  .category-links strong,
  .category-links small {
    display: block;
  }

  .category-links strong {
    font-size: var(--font-size-min, 0.875rem);
  }

  .category-links small {
    margin-top: 0.25rem;
    color: var(--atlas-muted);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .category-links i {
    color: var(--atlas-region-accent);
  }

  .detail-note {
    max-inline-size: 52rem;
    margin: 1.1rem 0 0;
    color: var(--atlas-muted);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.6;
  }

  .region-actions {
    margin-top: 1.25rem;
    padding-top: 1.1rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.65rem;
    border-top: 1px solid var(--atlas-stroke);
  }

  .all-terms,
  .open-region {
    box-sizing: border-box;
    min-height: 44px;
    padding: 0.65rem 1.05rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    border-radius: 999px;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    cursor: pointer;
  }

  .all-terms {
    color: var(--atlas-text);
    background: var(--atlas-card);
    border: 1px solid var(--atlas-stroke);
  }

  .open-region {
    color: var(--theme-button-text, #fff);
    text-decoration: none;
    background: color-mix(
      in oklch,
      var(--atlas-region-accent) 52%,
      oklch(0.24 0.035 275)
    );
    border: 1px solid color-mix(in oklch, var(--atlas-region-accent) 70%, white);
    box-shadow: 0 10px 28px
      color-mix(in oklch, var(--atlas-region-accent) 28%, transparent);
  }

  @container (min-width: 2200px) {
    .region-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .region-button {
      min-height: 190px;
    }

    .region-visual {
      height: 96px;
    }
  }

  @container (max-width: 1120px) {
    .atlas-hero,
    .atlas-workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    .atlas-hero {
      gap: 1.2rem;
    }

    .atlas-search {
      width: min(100%, 42rem);
    }

    .region-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .region-detail,
    .region-detail-inner {
      min-height: 0;
    }
  }

  @container (max-width: 760px) {
    .atlas-overview {
      padding-top: 0;
    }

    .atlas-intro h1 {
      font-size: clamp(2.75rem, 11cqi, 4rem);
    }

    .region-grid,
    .letter-type-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .region-detail-head {
      grid-template-columns: minmax(0, 1fr);
    }

    .region-count {
      width: fit-content;
      min-width: 0;
    }
  }

  @container (max-width: 500px) {
    .atlas-hero {
      margin-bottom: 1.25rem;
    }

    .atlas-intro p {
      font-size: 1rem;
    }

    .atlas-search-hint {
      left: 0.9rem;
      right: auto;
    }

    .region-grid,
    .letter-type-grid,
    .category-links {
      grid-template-columns: minmax(0, 1fr);
    }

    .region-button {
      min-height: 154px;
    }

    .region-visual {
      height: 66px;
    }

    .region-board-head {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }

    .region-actions {
      flex-direction: column-reverse;
    }

    .all-terms,
    .open-region {
      width: 100%;
    }
  }

  @media (max-height: 500px) and (min-width: 700px) {
    .atlas-hero {
      margin-bottom: 1rem;
    }

    .atlas-intro h1 {
      font-size: 2.7rem;
    }

    .atlas-intro p {
      max-inline-size: 60rem;
      font-size: 0.95rem;
    }

    .region-button {
      min-height: 134px;
    }

    .region-visual {
      height: 56px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .atlas-search input,
    .region-button,
    .category-links a {
      transition: none;
    }

    .region-button:hover {
      transform: none;
    }
  }
</style>
