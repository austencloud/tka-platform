<!--
  ComposerGalleryShelf

  The presentation page's save/gallery proof: the sequence carried through the
  page renders as a real gallery card, shelved beside real public sequences
  from the live gallery. Reuses ChoreoCardThumbnail (read-only host = static
  artwork) and PublicSequencesLoader; this file only composes them.

  The loading skeleton is rendered in-grid rather than through
  BrowseThumbnailSkeleton because that component owns its own grid and column
  math — the shelf needs skeleton cells inside the same tracks its cards will
  fill, or the loading and loaded layouts diverge.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import {
    pickShelfSequences,
    SHELF_CARD_ASPECT_RATIO,
  } from "./composer-gallery-shelf-curation";

  // Nine leaves the widest tier (5 columns) with two completely full rows once
  // the carried card is counted. Narrower tiers hide the tail in CSS.
  const SHELF_COUNT = 9;

  const {
    sequence,
    composed = false,
  }: {
    sequence: SequenceData;
    /** True once the visitor (or the builder above) has composed a sequence on this page. */
    composed?: boolean;
  } = $props();

  let galleryStatus = $state<"loading" | "ready" | "error">("loading");
  let shelf = $state<SequenceData[]>([]);

  async function loadShelf(): Promise<void> {
    galleryStatus = "loading";
    try {
      const all = await getBrowseLoader().loadSequenceMetadata();
      // The card resolves its own start-position layout from this manager, so
      // curation reads the same source rather than assuming a layout.
      const composition = getImageCompositionManager();
      shelf = pickShelfSequences(all, SHELF_COUNT, (steps) =>
        composition.getStartPositionLayoutForStepCount(steps)
      );
      galleryStatus = "ready";
    } catch {
      galleryStatus = "error";
    }
  }

  onMount(() => {
    void loadShelf();
  });

  const carriedLabel = $derived(
    composed ? "Built on this page" : "The sequence playing above"
  );
</script>

<div class="shelf">
  <div class="shelf-grid">
    <figure class="carried-cell">
      <div class="carried-frame">
        {#key sequence.id}
          <ChoreoCardThumbnail
            {sequence}
            bluePropType={PropType.STAFF}
            redPropType={PropType.STAFF}
            eager
            allowQR={false}
          />
        {/key}
      </div>
      <figcaption class="carried-tag">
        <span class="tag-sizer" aria-hidden="true"
          >The sequence playing above</span
        >
        <span class="tag-live">{carriedLabel}</span>
      </figcaption>
    </figure>

    {#if galleryStatus === "ready"}
      {#each shelf as entry (entry.id)}
        <div class="shelf-cell">
          <ChoreoCardThumbnail
            sequence={entry}
            bluePropType={PropType.STAFF}
            redPropType={PropType.STAFF}
            allowQR={false}
          />
        </div>
      {/each}
    {:else if galleryStatus === "loading"}
      {#each Array.from({ length: SHELF_COUNT }, (_, i) => i) as i (i)}
        <div
          class="skeleton-cell"
          aria-hidden="true"
          style:--stagger={i}
          style:aspect-ratio={SHELF_CARD_ASPECT_RATIO}
        ></div>
      {/each}
    {/if}
  </div>

  {#if galleryStatus === "loading"}
    <span class="sr-only" role="status">Loading public gallery sequences.</span>
  {/if}

  {#if galleryStatus === "error"}
    <div class="shelf-error" role="alert">
      <p>The public gallery did not load.</p>
      <button type="button" onclick={() => void loadShelf()}>
        Try the gallery again
      </button>
    </div>
  {/if}
</div>

<style>
  .shelf {
    container-type: inline-size;
    min-width: 0;
  }

  /* Column counts mirror the real gallery grid's breakpoints. Each tier shows
     exactly two full rows (carried card + gallery cards); the tail is hidden
     rather than left stranding a part-row against dead rail. */
  .shelf-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(0.8rem, 1.4vw, 1.4rem);
    align-items: start;
  }

  .shelf-grid > :nth-child(n + 5) {
    display: none;
  }

  @container (min-width: 800px) {
    .shelf-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .shelf-grid > :nth-child(n + 5) {
      display: block;
    }
    .shelf-grid > :nth-child(n + 7) {
      display: none;
    }
  }

  @container (min-width: 1200px) {
    .shelf-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .shelf-grid > :nth-child(n + 7) {
      display: block;
    }
    .shelf-grid > :nth-child(n + 9) {
      display: none;
    }
  }

  @container (min-width: 1600px) {
    .shelf-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    .shelf-grid > :nth-child(n + 9) {
      display: block;
    }
  }

  .carried-cell,
  .shelf-cell,
  .skeleton-cell {
    min-width: 0;
  }

  .carried-cell {
    margin: 0;
  }

  /* Selection-style full ring on the carried card — never an edge bar. */
  .carried-frame {
    border-radius: 0.9rem;
    box-shadow:
      0 0 0 2px var(--theme-panel-bg, oklch(0.13 0.025 270 / 0.94)),
      0 0 0 4px oklch(0.72 0.15 278 / 0.85);
  }

  /* Grid (not inline-grid) so the tag is bounded by its column and wraps
     instead of running under the neighbouring card at phone widths. */
  .carried-tag {
    display: grid;
    margin-top: 0.55rem;
    color: oklch(0.85 0.1 278);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* The hidden sizer holds the longest label, so the cell already reserves the
     height that label needs — wrapped or not — and swapping labels never
     reflows the shelf. */
  .tag-sizer,
  .tag-live {
    grid-area: 1 / 1;
  }

  .tag-sizer {
    visibility: hidden;
  }

  .skeleton-cell {
    /* aspect-ratio comes from SHELF_CARD_ASPECT_RATIO inline, so the skeleton
       reserves the shape the real cards render at. */
    border-radius: 0.9rem;
    background: linear-gradient(
      100deg,
      oklch(0.2 0.03 270 / 0.7) 40%,
      oklch(0.26 0.04 274 / 0.8) 50%,
      oklch(0.2 0.03 270 / 0.7) 60%
    );
    background-size: 200% 100%;
    animation: shelf-shimmer 1.6s ease-in-out infinite;
    animation-delay: calc(var(--stagger) * 120ms);
  }

  @keyframes shelf-shimmer {
    from {
      background-position: 120% 0;
    }
    to {
      background-position: -80% 0;
    }
  }

  .shelf-error {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.9rem;
    margin-top: 1.1rem;
    color: oklch(0.72 0.02 270);
    font-size: var(--font-size-min, 0.875rem);
  }

  .shelf-error p {
    margin: 0;
  }

  .shelf-error button {
    min-height: max(var(--min-touch-target, 48px), 48px);
    display: inline-flex;
    align-items: center;
    padding: 0.72em 1.15em;
    border: 1px solid var(--theme-stroke-strong, oklch(0.58 0.04 270 / 0.34));
    border-radius: var(--settings-radius-lg, 0.85rem);
    background: var(--theme-card-bg, oklch(0.18 0.025 270 / 0.75));
    color: #fff;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
    cursor: pointer;
  }

  .shelf-error button:hover {
    border-color: oklch(0.72 0.12 277 / 0.65);
  }

  .shelf-error button:focus-visible {
    outline: 2px solid var(--theme-accent, #8b8cff);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-cell {
      animation: none;
    }
  }
</style>
