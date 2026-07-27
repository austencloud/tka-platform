<!--
  Profile Stage

  The three bands that replace the profile's single wall of choreo cards:
  Showcase (a few, big, one per medium), Collections (everything saved, mixed
  and filterable), Archive (the whole library, small).

  Each artifact renders in ITS OWN medium — a sequence animates, a 3D scene
  loads the real Viewer3DCanvas, a mandala draws from its steps — rather than
  every one of them flattening into the same card front. ArtifactTile owns that;
  LiveSlots budgets how many may animate at once so a 505-item library does not
  try to run 505 render loops.

  Design: docs/superpowers/specs/2026-07-26-profile-as-stage-design.md
  Proven in the harness at /test/profile-stage, which now renders this same
  component so the two cannot drift.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { scene3dCollectionState } from "$lib/features/scene-3d-collection/state/scene-3d-collection-state.svelte";
  import { scene3DHasSteps } from "$lib/features/scene-3d-collection/services/open-3d-scene";
  import { tunnelCollectionState } from "$lib/features/tunnel-collection/state/tunnel-collection-state.svelte";
  import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
  import { fitColumns } from "$lib/features/creators/domain/fit-columns";
  import { sortSequences } from "$lib/shared/browse/services/browse-sorter";
  import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import ArtifactTile from "./ArtifactTile.svelte";
  import { LiveSlots, type Medium } from "./live-slots.svelte";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    userId,
    archiveCap = 120,
  }: {
    userId: string;
    /**
     * How many archive tiles to mount. The archive is the whole library, which
     * for the author of this feature is 505 sequences; mounting every one costs
     * more than any viewport can show. A real virtualiser is the eventual
     * answer — this cap is what keeps the band honest until then.
     */
    archiveCap?: number;
  } = $props();

  const slots = new LiveSlots();
  onDestroy(() => slots.destroy());

  let sequences = $state<LibrarySequence[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const id = userId;
    if (!id) return;

    scene3dCollectionState.ensureStarted(id);
    tunnelCollectionState.ensureStarted(id);
    mandalaCollectionState.ensureStarted(id);

    loading = true;
    loadError = null;
    getLibraryRepository()
      .getUserSequences(id, {})
      .then((result) => {
        sequences = result;
        loading = false;
      })
      .catch((err: unknown) => {
        loadError = err instanceof Error ? err.message : "Failed to load library";
        loading = false;
      });
  });

  const scenes = $derived(scene3dCollectionState.collection);
  const tunnels = $derived(tunnelCollectionState.collection);
  const mandalas = $derived(mandalaCollectionState.collection);

  const sortedSequences = $derived(
    sortSequences(
      [...sequences] as SequenceData[],
      BrowseSortMethod.DATE_ADDED
    ) as LibrarySequence[]
  );

  const archive = $derived(sortedSequences.slice(0, archiveCap));

  /**
   * The Showcase stands in for pinned items. `PinnedItem` exists on the profile
   * already but nothing writes it, so rather than show an empty band we
   * auto-pick one newest artifact per medium plus the top-starred sequence.
   * When pinning ships this derivation is what it replaces.
   */
  const showcase = $derived.by(() => {
    const picks: {
      key: string;
      medium: Medium;
      title: string;
      sequence?: SequenceData;
      poster?: string;
      tunnel?: any;
      scene?: any;
      mandala?: any;
    }[] = [];

    const topStarred = [...sequences].sort(
      (a, b) => (b.starCount ?? 0) - (a.starCount ?? 0)
    )[0];
    if (topStarred) {
      picks.push({
        key: `seq-${topStarred.id}`,
        medium: "sequence",
        title: topStarred.word || topStarred.name || "Sequence",
        sequence: topStarred,
      });
    }

    const scene = scenes[0];
    if (scene) {
      picks.push({
        key: `scene-${scene.id}`,
        medium: "scene",
        title: scene.sourceWord || scene.name,
        poster: scene.poster,
        // Only a scene saved WITH a performance can animate; a look-only save
        // has no steps for the puppet loop to position anyone to.
        scene: scene3DHasSteps(scene) ? scene : null,
      });
    }

    const mandala = mandalas[0];
    if (mandala) {
      picks.push({
        key: `mandala-${mandala.id}`,
        medium: "mandala",
        title: mandala.sourceWord || mandala.name,
        mandala,
      });
    }

    const tunnel = tunnels[0];
    if (tunnel) {
      picks.push({
        key: `tunnel-${tunnel.id}`,
        medium: "tunnel",
        title: tunnel.name,
        poster: tunnel.poster,
        tunnel,
      });
    }

    return picks;
  });

  // Column counts are pinned per tier and routed through fitColumns so a band
  // never strands one tile in its own row (4k-native-layout.md). This is the
  // rule ProfileTabs' `repeat(auto-fill, minmax(240px, 1fr))` breaks.
  let viewportWidth = $state(1920);
  $effect(() => {
    const measure = () => (viewportWidth = window.innerWidth);
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  });

  function capFor(band: "showcase" | "collection" | "archive"): number {
    const w = viewportWidth;
    if (band === "showcase") {
      if (w >= 2600) return 5;
      if (w >= 1680) return 4;
      if (w >= 1100) return 3;
      if (w >= 700) return 2;
      return 1;
    }
    if (band === "collection") {
      if (w >= 3400) return 8;
      if (w >= 2600) return 7;
      if (w >= 1680) return 6;
      if (w >= 1100) return 4;
      if (w >= 700) return 3;
      return 2;
    }
    if (w >= 3400) return 10;
    if (w >= 2600) return 8;
    if (w >= 1680) return 7;
    if (w >= 1100) return 5;
    if (w >= 700) return 4;
    return 2;
  }

  /**
   * ONE mixed Collections grid, not three type-segregated subbands.
   *
   * Segregating by medium looked tidy and read badly: the counts are lopsided
   * (1 scene, 4 tunnels, 41 mandalas), so at 3840 the scenes row was one tile
   * beside seven empty tracks and the tunnels row four beside four. Interleaving
   * by recency keeps every row full at every width AND puts the variety of media
   * on show, which is the whole argument for the band. The filter covers the
   * "just show me my tunnels" case that sections were really serving.
   */
  type ArtifactMandala = {
    steps: unknown[];
    variant: "blue" | "red" | "both";
    bluePropType?: string;
    redPropType?: string;
    pathShape?: "arc" | "linear" | "concave" | "hybrid";
  };

  type CollectionEntry = {
    id: string;
    medium: Medium;
    title: string;
    at: number;
    poster: string | null;
    scene: unknown | null;
    tunnel: unknown | null;
    mandala: ArtifactMandala | null;
  };

  function stamp(record: Record<string, any>): number {
    return record.createdAt ?? record.updatedAt ?? 0;
  }

  const collectionEntries = $derived.by((): CollectionEntry[] => {
    const out: CollectionEntry[] = [];

    for (const entry of scenes) {
      const r = entry as Record<string, any>;
      out.push({
        id: `scene-${entry.id}`,
        medium: "scene",
        title: r.sourceWord || entry.name,
        at: stamp(r),
        poster: r.poster ?? null,
        scene: scene3DHasSteps(entry as any) ? entry : null,
        tunnel: null,
        mandala: null,
      });
    }
    for (const entry of tunnels) {
      const r = entry as Record<string, any>;
      out.push({
        id: `tunnel-${entry.id}`,
        medium: "tunnel",
        title: r.sourceWord || entry.name,
        at: stamp(r),
        poster: r.poster ?? null,
        scene: null,
        tunnel: entry,
        mandala: null,
      });
    }
    for (const entry of mandalas) {
      const r = entry as Record<string, any>;
      out.push({
        id: `mandala-${entry.id}`,
        medium: "mandala",
        title: r.sourceWord || entry.name,
        at: stamp(r),
        poster: null,
        scene: null,
        tunnel: null,
        mandala: {
          steps: r.steps ?? [],
          variant: r.variant ?? "both",
          bluePropType: r.bluePropType,
          redPropType: r.redPropType,
          pathShape: r.pathShape,
        },
      });
    }

    return out.sort((a, b) => b.at - a.at);
  });

  const totalSaved = $derived(collectionEntries.length);

  let collectionFilter = $state<"all" | Medium>("all");

  const visibleCollection = $derived(
    collectionFilter === "all"
      ? collectionEntries
      : collectionEntries.filter((e) => e.medium === collectionFilter)
  );

  /** Counts ride along on the chips, so the filter doubles as the census the
   *  type sections used to provide. Media with nothing saved are omitted
   *  rather than shown as a dead 0. */
  const collectionFilterOptions = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const e of collectionEntries) counts[e.medium] = (counts[e.medium] ?? 0) + 1;
    const opts: { value: string; label: string; count?: number }[] = [
      { value: "all", label: "All", count: collectionEntries.length },
    ];
    if (counts.scene) opts.push({ value: "scene", label: "Scenes", count: counts.scene });
    if (counts.tunnel) opts.push({ value: "tunnel", label: "Tunnels", count: counts.tunnel });
    if (counts.mandala)
      opts.push({ value: "mandala", label: "Mandalas", count: counts.mandala });
    return opts;
  });
</script>

<div class="stage">
  {#if loadError}
    <PanelState type="error" title="Could not load library" message={loadError} />
  {:else}
    <section class="band" aria-labelledby="band-showcase">
      <header class="band-head">
        <h2 id="band-showcase">Showcase</h2>
        <span class="rule" aria-hidden="true"></span>
        <span class="band-count">{showcase.length}</span>
      </header>
      {#if showcase.length === 0}
        <p class="band-empty">
          Nothing saved yet — the showcase fills from your collections.
        </p>
      {:else}
        <div
          class="grid showcase-grid"
          style:--cols={fitColumns(showcase.length, capFor("showcase"))}
        >
          {#each showcase as pick (pick.key)}
            <ArtifactTile
              {slots}
              medium={pick.medium}
              title={pick.title}
              sequence={pick.sequence ?? null}
              poster={pick.poster ?? null}
              tunnel={pick.tunnel ?? null}
              scene={pick.scene ?? null}
              mandala={pick.mandala ?? null}
              size="lg"
            />
          {/each}
        </div>
      {/if}
    </section>

    <section class="band" aria-labelledby="band-collections">
      <header class="band-head">
        <h2 id="band-collections">Collections</h2>
        <span class="rule" aria-hidden="true"></span>
        <span class="band-count">{totalSaved}</span>
      </header>

      {#if totalSaved === 0}
        <p class="band-empty">
          No saved scenes, tunnels, or mandalas on this account yet.
        </p>
      {:else}
        {#if collectionFilterOptions.length > 2}
          <div class="filter">
            <SegmentedControl
              options={collectionFilterOptions}
              value={collectionFilter}
              onchange={(v) => (collectionFilter = v as "all" | Medium)}
              size="sm"
              ariaLabel="Filter collections by medium"
            />
          </div>
        {/if}

        <div
          class="grid"
          style:--cols={fitColumns(visibleCollection.length, capFor("collection"))}
        >
          {#each visibleCollection as entry (entry.id)}
            <ArtifactTile
              {slots}
              medium={entry.medium}
              title={entry.title}
              poster={entry.poster}
              scene={entry.scene}
              tunnel={entry.tunnel}
              mandala={entry.mandala}
            />
          {/each}
        </div>
      {/if}
    </section>

    <section class="band" aria-labelledby="band-archive">
      <header class="band-head">
        <h2 id="band-archive">Archive</h2>
        <span class="rule" aria-hidden="true"></span>
        <span class="band-count">{sequences.length}</span>
      </header>

      {#if loading}
        <PanelState type="loading" message="Loading your library..." />
      {:else}
        <div class="grid" style:--cols={fitColumns(archive.length, capFor("archive"))}>
          {#each archive as sequence (sequence.id)}
            <ArtifactTile
              {slots}
              medium="sequence"
              title={sequence.word || sequence.name || "Untitled"}
              {sequence}
              size="sm"
            />
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  /* The stage carries its own container-query font ramp, so every band, tile
     and label scales in lockstep from one declaration (4k-native-layout.md).
     Everything below sizes in `em`; a `rem` here would freeze at 1080p
     proportions while its neighbours grew. */
  .stage {
    container-type: inline-size;
    font-size: clamp(1rem, calc(1rem + (100cqw - 1616px) * 8 / 2160), 1.5rem);

    /* Shared primitives on this surface size themselves from these tokens in
       rem, which would strand them at 1080p. Redefining them in `em` hands them
       the ramp; the values match the global rem defaults at the 16px floor, so
       nothing moves below the seam. */
    --font-size-sm: 0.875em;
    --font-size-compact: 0.75em;

    display: flex;
    flex-direction: column;
    gap: clamp(1.5em, 3cqw, 3em);
    width: 100%;
    min-width: 0;
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: 0.85em;
  }

  .band-head {
    display: flex;
    align-items: center;
    gap: 0.9em;
  }

  .band-head h2 {
    margin: 0;
    font-size: 0.9375em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .rule {
    flex: 1;
    height: 1px;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.12));
  }

  .band-count {
    font-size: 0.9375em;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }

  .band-empty {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.9375em;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: clamp(0.75em, 1.2cqw, 1.25em);
    align-items: start;
  }

  .filter {
    /* SegmentedControl declares width: 100%, so a bare `flex: 0 0 auto` loses
       (flex-basis: auto resolves to that width). Pin it or four short labels
       stretch across the whole band (visual-verification-mandatory.md). */
    width: max-content;
    max-width: 100%;
  }

  .filter :global(.segmented-control) {
    width: max-content;
    max-width: 100%;
  }

  /* Short-landscape: a grid of 1:1 tiles can't fit even one row, so the
     showcase becomes a horizontal strip you swipe. Grid everywhere else —
     this is the one viewport where the band changes shape, not a mobile
     pattern imposed on desktop. */
  @media (max-height: 560px) {
    .showcase-grid {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      gap: clamp(0.75em, 1.2cqw, 1.25em);
      padding-bottom: 0.5em;
      -webkit-overflow-scrolling: touch;
    }

    .showcase-grid > :global(*) {
      flex: 0 0 auto;
      width: min(62vh, 70vw);
      scroll-snap-align: start;
    }
  }
</style>
