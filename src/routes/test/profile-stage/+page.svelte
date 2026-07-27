<!--
  Test harness for the profile-as-stage design
  (docs/superpowers/specs/2026-07-26-profile-as-stage-design.md).

  Real components, real data — your own library and your own three saved-artifact
  collections, read straight from Firestore. Nothing here is a mockup
  (visualization-routing.md: this codebase has the primitives, so the test page
  renders them rather than faking them).

  What this harness answers: does the three-band structure beat the wall, does
  content variety read well, and how does live-on-visible feel.

  Live 3D IS answered here now — Scene3DPreview seeds a per-instance viewer
  (see viewer-3d-state's Viewer3DStateSeed), so scene tiles render the real
  Viewer3DCanvas in their own environment and several can coexist. The scissored
  multi-viewport renderer is a later question about COST, not capability.

  The Collections band is one mixed grid rather than three type sections, and
  the page carries its own container-query font ramp — both decided with Austen
  on 2026-07-27; see the design doc for why.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { page } from "$app/state";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
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
  import ProfileHeroSection from "$lib/features/creators/components/profile/ProfileHeroSection.svelte";
  import { getUserProfile } from "$lib/shared/community/services/user-repository";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import ArtifactTile from "./ArtifactTile.svelte";
  import { LiveSlots, MEDIA, type Medium } from "./live-slots.svelte";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const slots = new LiveSlots();
  onDestroy(() => slots.destroy());

  /**
   * `?solo` — one sequence, big, nothing else. An isolation rig for the
   * mandala/animation registration: no bands, no budgets, no scroll, so what
   * you are looking at is only the composite and a change to it is immediately
   * visible. Same ArtifactTile the stage uses, so it is the real thing.
   */
  const solo = $derived(
    typeof window !== "undefined" &&
      new URLSearchParams(page.url.search).has("solo")
  );

  let sequences = $state<LibrarySequence[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  /** Cap the archive so the harness stays usable while you judge composition.
   *  The real design virtualises; this is a knob, not a proposal. */
  let archiveCap = $state(120);
  let layout = $state<"stage" | "wall">("stage");

  const uid = $derived(authState.user?.uid ?? null);

  /** The real hero the live profile renders, so the bands are judged under the
   *  chrome they will actually sit beneath — not floating on a bare page. */
  let userProfile = $state<EnhancedUserProfile | null>(null);
  $effect(() => {
    const id = uid;
    if (!id) return;
    void getUserProfile(id)
      .then((p) => (userProfile = p))
      .catch(() => (userProfile = null));
  });

  $effect(() => {
    const id = uid;
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
    sortSequences([...sequences] as SequenceData[], BrowseSortMethod.DATE_ADDED) as LibrarySequence[]
  );

  const archive = $derived(sortedSequences.slice(0, archiveCap));

  /**
   * The Showcase stands in for pinned items. `PinnedItem` exists on the profile
   * already but nothing writes it, so rather than ship an empty band the
   * harness auto-picks one newest artifact per medium plus the top-starred
   * sequence — enough to judge whether a heterogeneous curated row reads well.
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
  // rule ProfileTabs' `repeat(auto-fill, minmax(240px, 1fr))` currently breaks.
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
   * on show, which is the whole argument for the band. The filter below covers
   * the "just show me my tunnels" case that sections were really serving.
   */
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

  type ArtifactMandala = {
    steps: unknown[];
    variant: "blue" | "red" | "both";
    bluePropType?: string;
    redPropType?: string;
    pathShape?: "arc" | "linear" | "concave" | "hybrid";
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
    if (counts.mandala) opts.push({ value: "mandala", label: "Mandalas", count: counts.mandala });
    return opts;
  });

  function bump(medium: Medium, delta: number) {
    const next = Math.max(0, Math.min(24, slots.budgets[medium] + delta));
    slots.budgets = { ...slots.budgets, [medium]: next };
    slots.schedule();
  }
</script>

<svelte:head>
  <title>Profile as a stage — test</title>
</svelte:head>

{#if solo}
  {@const first = showcase[0]}
  <div class="solo-page">
    {#if first?.sequence}
      <div class="solo-subject">
        <ArtifactTile
          {slots}
          medium="sequence"
          title={first.title}
          sequence={first.sequence}
          size="lg"
        />
      </div>
    {:else}
      <PanelState type="loading" message="Loading your library..." />
    {/if}
  </div>
{:else}
<div class="stage-container">
<div class="page">
  <header class="page-head">
    <div class="titles">
      <h1>Profile as a stage</h1>
      <p class="sub">
        Your real library and your three saved-artifact collections, rendered as
        three bands instead of one wall.
      </p>
    </div>

    <!-- SegmentedControl declares width: 100%, which defeats a plain
         `flex: 0 0 auto` here — flex-basis: auto resolves to that width and the
         control stretches to 1656px for two short labels. The wrapper pins the
         width so it sizes to its labels (visual-verification-mandatory.md). -->
    <div class="layout-switch">
      <SegmentedControl
        options={[
          { value: "stage", label: "Stage" },
          { value: "wall", label: "Archive only" },
        ]}
        value={layout}
        onchange={(v) => (layout = v)}
        size="sm"
        ariaLabel="Layout"
      />
    </div>
  </header>

  <section class="controls" aria-label="Liveness budgets">
    {#each MEDIA as medium (medium)}
      <div class="budget">
        <span class="budget-name">{medium}</span>
        <div class="budget-controls">
          <button onclick={() => bump(medium, -1)} aria-label="Fewer live {medium} tiles">
            &minus;
          </button>
          <span class="budget-value">{slots.liveCount[medium]}/{slots.budgets[medium]}</span>
          <button onclick={() => bump(medium, 1)} aria-label="More live {medium} tiles">
            +
          </button>
        </div>
      </div>
    {/each}

    <div class="budget">
      <span class="budget-name">archive shown</span>
      <div class="budget-controls">
        <button onclick={() => (archiveCap = Math.max(20, archiveCap - 60))} aria-label="Show fewer">
          &minus;
        </button>
        <span class="budget-value">{archive.length}/{sequences.length}</span>
        <button onclick={() => (archiveCap = archiveCap + 60)} aria-label="Show more">+</button>
      </div>
    </div>
  </section>

  {#if userProfile}
    <!-- Block wrapper, deliberately. ProfileHeroSection centres itself with
         `margin-inline: auto` and declares `container-type: inline-size`. An
         auto cross-axis margin on a FLEX item suppresses stretch, so as a
         direct child of this flex column the hero sized to its own contents —
         and containment makes that zero, collapsing it to 64px of padding.
         Block layout is what the live panel gives it. Worth remembering when
         the stage moves into UserProfilePanel: the band wrapper must not be a
         flex column around this component. -->
    <div class="hero-slot">
      <ProfileHeroSection
        {userProfile}
        currentUserId={uid}
        isOwnProfile={true}
        followInProgress={false}
        onFollowToggle={() => {}}
      />
    </div>
  {/if}

  {#if !uid}
    <PanelState
      type="empty"
      icon="fa-user"
      title="Sign in to load your profile"
      message="This harness reads your own library and collections from Firestore."
    />
  {:else if loadError}
    <PanelState type="error" title="Could not load library" message={loadError} />
  {:else}
    {#if layout === "stage"}
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
    {/if}

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
</div>
{/if}

<style>
  .solo-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  /* Big enough that a geometry difference is unmissable, capped so the strip
     still fits a 1080-tall viewport. */
  .solo-subject {
    width: min(92vw, 78vh);
  }

  /* Establishes the query container ONLY — an element cannot query itself, so
     the ramp below has to sit on a child or `cqw` would resolve against the
     next container up. Same split CreatorsPanel uses. */
  .stage-container {
    container-type: inline-size;
    container-name: profile-stage;
    width: 100%;
  }

  .page {
    /* THE 4K RAMP. `app.css`'s root ramp is scoped to `html:has(.mkt-shell)`
       and `.legal-container`, so it does not reach in-app modules — without
       this the profile is frozen at 1080p proportions on a 4K display
       (measured: 16px root at 3840). Identical floor, seam and slope to
       CreatorsPanel's `.roster-view`, so the roster and the profile you reach
       from it feel like one surface. Every descendant sizes in `em`. */
    font-size: clamp(1rem, calc(1rem + (100cqw - 1616px) * 8 / 2160), 1.5rem);

    /* Shared primitives on this surface size themselves from these tokens in
       rem, which would strand them at 1080p while everything else ramps.
       Redefining them in `em` hands them the ramp; the values match the global
       rem defaults at the 16px floor, so nothing moves below the seam. */
    --font-size-sm: 0.875em;
    --font-size-compact: 0.75em;

    /* NO max-width, deliberately. `--shell-w` ceilings at 2600px, which at a
       3840 viewport left 620px of dead rail on each side — 32% of the screen,
       measured — inside a box the app sidebar has already inset. That is the
       exact failure 4k-native-layout.md forbids, and it is why CreatorsPanel
       sizes its own band the same way: fluid padding above a floor, no cap. */
    width: 100%;
    padding: clamp(1em, 2.2cqw, 3.5em) clamp(1rem, 2.2cqw, 3.5rem) 6em;
    display: flex;
    flex-direction: column;
    gap: clamp(1.5em, 3cqw, 3em);
  }

  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.5rem, 2.4vw, 2.25rem);
    font-weight: 700;
    color: var(--theme-text);
  }

  .sub {
    margin: 0.35rem 0 0;
    color: var(--theme-text-dim);
    font-size: 0.9375rem;
  }

  .layout-switch {
    flex: 0 0 auto;
    width: max-content;
  }

  .layout-switch :global(.segmented-control) {
    width: max-content;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-panel-bg);
  }

  .budget {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .budget-name {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim);
  }

  .budget-controls {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .budget-controls button {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.375rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1;
  }

  .budget-controls button:hover {
    background: var(--theme-card-hover-bg);
  }

  .budget-value {
    /* Changing numbers get tabular figures so the row never jitters as tokens
       are granted and revoked (no-layout-shift.md). */
    font-variant-numeric: tabular-nums;
    font-size: 0.8125rem;
    color: var(--theme-text);
    min-width: 4.5ch;
    text-align: center;
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .band-head {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .band-head h2 {
    margin: 0;
    font-size: 0.8125rem;
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
    font-size: 0.8125rem;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }

  .band-empty {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.9375rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: clamp(0.75em, 1.2cqw, 1.25em);
    align-items: start;
  }

  .hero-slot {
    display: block;
    width: 100%;
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
