<!--
  ComposerGalleryDemo

  A live miniature of the community gallery: a level picker driving a small
  grid of REAL public sequence thumbnails, fetched straight from the same
  publicSequences Firestore collection the app's Browse gallery reads
  (PublicSequencesLoader, the same loader PlayWithItInner.svelte uses on the
  public /landing page — src/routes/landing/components/PlayWithItInner.svelte:107).

  The whole index is loaded ONCE on mount (metadata only — no step data, so
  this is cheap), then level filtering happens locally against the already-
  loaded array. The Firebase/Firestore chunk is heavy, so the loader getter is
  pulled in dynamically after idle, matching the sibling demos' pattern
  (ComposerGenerateDemo.svelte, ComposerHeroDemo.svelte).

  Grid cells are fixed-aspect boxes (matching the stored thumbnail's 720x594
  render) so swapping levels never resizes the grid itself — only the images
  inside it change. Only entries with a real thumbnails[0] are eligible for a
  cell; the count line beneath reports the full level cohort regardless of
  thumbnail availability ("N public sequences at this level").
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  type Level = "1" | "2" | "3";
  type LoadState = "loading" | "loaded" | "error";

  let selectedLevel = $state<Level>("2");
  let loadState = $state<LoadState>("loading");
  let entries = $state<SequenceData[] | null>(null);

  const levelEntries = $derived(
    (entries ?? []).filter((e) => e.level === Number(selectedLevel))
  );
  const thumbEntries = $derived(
    levelEntries.filter((e) => e.thumbnails.length > 0 && Boolean(e.thumbnails[0]))
  );
  const shown = $derived(thumbEntries.slice(0, 6));
  // The count line reads "public sequences at this level" — the full level
  // cohort, not just the subset that happens to have a thumbnail cached.
  const totalCount = $derived(levelEntries.length);
  const isEmpty = $derived(loadState === "loaded" && shown.length === 0);

  onMount(() => {
    const load = async () => {
      try {
        const { getBrowseLoader } = await import("$lib/shared/browse/get-browse-loader");
        const loader = getBrowseLoader();
        entries = await loader.loadSequenceMetadata();
        loadState = "loaded";
      } catch (err) {
        console.error("[ComposerGalleryDemo] Failed to load public index:", err);
        loadState = "error";
      }
    };

    // Static prerendered page: let the prose paint first, then pull the
    // Firebase/Firestore chunk and query the public index.
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => void load(), { timeout: 3000 });
    } else {
      setTimeout(() => void load(), 400);
    }
  });
</script>

<div class="gallery-demo">
  <div class="level-row">
    <SegmentedControl
      options={[
        { value: "1", label: "Level 1" },
        { value: "2", label: "Level 2" },
        { value: "3", label: "Level 3" },
      ]}
      value={selectedLevel}
      onchange={(v) => (selectedLevel = v as Level)}
      color="accent"
      size="sm"
    />
  </div>

  {#if loadState === "loading"}
    <div class="thumb-grid" aria-hidden="true">
      {#each Array(6) as _, i (i)}
        <div class="thumb-cell skeleton"></div>
      {/each}
    </div>
  {:else if loadState === "error" || isEmpty}
    <p class="quiet-note">Gallery is taking a moment. Open the app to browse.</p>
  {:else}
    <div class="thumb-grid">
      {#each shown as entry (entry.id)}
        <div class="thumb-cell">
          <img
            src={entry.thumbnails[0] ?? ""}
            alt={simplifyRepeatedWord(entry.word)}
            loading="lazy"
          />
        </div>
      {/each}
    </div>
    <p class="count-row">{totalCount} public sequences at this level</p>
  {/if}
</div>

<style>
  .gallery-demo {
    margin-top: 1.8rem;
  }

  .level-row {
    max-width: 22rem;
    margin: 0 auto 1rem;
  }

  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }

  .thumb-cell {
    position: relative;
    aspect-ratio: 720 / 594;
    border-radius: 12px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
  }

  .thumb-cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-cell.skeleton {
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.9;
    }
  }

  .count-row {
    text-align: center;
    margin-top: 0.8rem;
    font-size: 0.85rem;
    color: oklch(0.6 0.02 270);
    font-variant-numeric: tabular-nums;
  }

  .quiet-note {
    text-align: center;
    font-style: italic;
    font-size: 0.85rem;
    color: oklch(0.6 0.02 270);
    padding: 2.4rem 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb-cell.skeleton {
      animation: none;
    }
  }
</style>
