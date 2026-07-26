<!--
  Test harness for the profile-as-stage design
  (docs/superpowers/specs/2026-07-26-profile-as-stage-design.md).

  Real components, real data — your own library and your own three saved-artifact
  collections, read straight from Firestore. Nothing here is a mockup
  (visualization-routing.md: this codebase has the primitives, so the test page
  renders them rather than faking them).

  What this harness answers: does the three-band structure beat the wall, does
  content variety read well, and how does live-on-visible feel.

  What it deliberately does NOT answer: live 3D. `Viewer3DCanvas` is a
  single-viewer component and there is no WebGL context pool anywhere in
  src/lib, so scene and tunnel tiles render their stored WebP posters and their
  budgets start at 0. The scissored multi-viewport renderer is a spike, not a
  test page.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { scene3dCollectionState } from "$lib/features/scene-3d-collection/state/scene-3d-collection-state.svelte";
  import { tunnelCollectionState } from "$lib/features/tunnel-collection/state/tunnel-collection-state.svelte";
  import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
  import { fitColumns } from "$lib/features/creators/domain/fit-columns";
  import { sortSequences } from "$lib/shared/browse/services/browse-sorter";
  import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import ArtifactTile from "./ArtifactTile.svelte";
  import { LiveSlots, MEDIA, type Medium } from "./live-slots.svelte";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const slots = new LiveSlots();
  onDestroy(() => slots.destroy());

  let sequences = $state<LibrarySequence[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  /** Cap the archive so the harness stays usable while you judge composition.
   *  The real design virtualises; this is a knob, not a proposal. */
  let archiveCap = $state(120);
  let layout = $state<"stage" | "wall">("stage");

  const uid = $derived(authState.user?.uid ?? null);

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

  const collectionBands = $derived([
    { id: "scene" as Medium, name: "3D scenes", items: scenes },
    { id: "tunnel" as Medium, name: "Tunnels", items: tunnels },
    { id: "mandala" as Medium, name: "Mandalas", items: mandalas },
  ]);

  const totalSaved = $derived(scenes.length + tunnels.length + mandalas.length);

  function bump(medium: Medium, delta: number) {
    const next = Math.max(0, Math.min(24, slots.budgets[medium] + delta));
    slots.budgets = { ...slots.budgets, [medium]: next };
    slots.schedule();
  }
</script>

<svelte:head>
  <title>Profile as a stage — test</title>
</svelte:head>

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
          <div class="grid" style:--cols={fitColumns(showcase.length, capFor("showcase"))}>
            {#each showcase as pick (pick.key)}
              <ArtifactTile
                {slots}
                medium={pick.medium}
                title={pick.title}
                sequence={pick.sequence ?? null}
                poster={pick.poster ?? null}
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
        {/if}

        {#each collectionBands as group (group.id)}
          {#if group.items.length > 0}
            <div class="subband">
              <h3>{group.name} <span class="band-count">{group.items.length}</span></h3>
              <div
                class="grid"
                style:--cols={fitColumns(group.items.length, capFor("collection"))}
              >
                {#each group.items as entry (entry.id)}
                  {@const record = entry as Record<string, any>}
                  <ArtifactTile
                    {slots}
                    medium={group.id}
                    title={record.sourceWord || entry.name}
                    poster={record.poster ?? null}
                    mandala={group.id === "mandala"
                      ? {
                          steps: record.steps ?? [],
                          variant: record.variant ?? "both",
                          bluePropType: record.bluePropType,
                          redPropType: record.redPropType,
                          pathShape: record.pathShape,
                        }
                      : null}
                  />
                {/each}
              </div>
            </div>
          {/if}
        {/each}
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

<style>
  .page {
    /* One band for the whole page, fluid above its floor — never a hard cap
       that leaves dead rail at 2560 and 3840 (4k-native-layout.md). */
    width: 100%;
    max-width: var(--shell-w, min(1720px, 92vw));
    margin-inline: auto;
    padding: clamp(1rem, 2vw, 2.5rem) clamp(0.75rem, 2vw, 2rem) 6rem;
    display: flex;
    flex-direction: column;
    gap: clamp(1.5rem, 3vw, 3rem);
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

  .subband {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .subband h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: clamp(0.75rem, 1.2vw, 1.25rem);
    align-items: start;
  }
</style>
