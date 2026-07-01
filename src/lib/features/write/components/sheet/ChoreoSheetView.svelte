<!--
  ChoreoSheetView.svelte

  The choreo-sheet builder surface inside the Write module. Pick sequences →
  reorder/remove rows → tune layout (step numbers, block separator) → see the
  live landscape preview → export a print-ready PDF (and save the sheet).

  Owns the builder state (createChoreoSheetState) and sets the context so any
  descendant can read it. Sequences are added via the multi-select picker
  (additive — removal/reorder happen here in the row list); the picker, preview,
  and PDF all read the same planned pages, so what you see is what prints.

  `seedAct` lets the Act editor hand its roster over ("Send to Sheet") — the Act
  already carries hydrated sequences, so seeding skips the library round-trip.
-->
<script lang="ts">
  import { flip } from "svelte/animate";
  import {
    createChoreoSheetState,
    setChoreoSheetContext,
  } from "../../state/choreo-sheet-state.svelte";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { getChoreoSheetRepository } from "../../services/choreo-sheet-repository";
  import { downloadChoreoSheetPDF } from "../../services/sheet-pdf-exporter";
  import type { GroupSeparator } from "../../domain/types/choreo-sheet";
  import type { ActData } from "../../domain/types/write";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import SheetPreviewPages from "./SheetPreviewPages.svelte";
  import BrowseGrid from "$lib/features/browse/sequences/display/components/BrowseGrid.svelte";
  import { getBrowseThumbnailProvider } from "$lib/shared/browse/get-browse-thumbnail-provider";

  let { seedAct = undefined }: { seedAct?: ActData } = $props();

  // Builder-state object. loadSequence is the hydrating library read (NOT the
  // gallery metadata loader, which returns empty steps).
  const builder = createChoreoSheetState({
    loadSequence: (id) => getLibraryRepository().getSequence(id),
  });
  setChoreoSheetContext({ state: builder });

  // Editable sheet name (local; merged into the sheet on save). Not drawn on the
  // sheet itself — sheets are label-free by design — only used to name the file
  // and the saved record.
  let sheetName = $state(builder.sheet.name || "Untitled Sheet");

  // Seed from an Act once, when handed one.
  let seededActId: string | null = null;
  $effect(() => {
    if (seedAct && seedAct.id !== seededActId) {
      seededActId = seedAct.id;
      builder.seedFromAct(seedAct);
      sheetName = builder.sheet.name || sheetName;
    }
  });

  // id → hydrated sequence, for the row list labels/counts. Ids still hydrating
  // simply show "Loading…" until their data resolves.
  const byId = $derived(
    new Map<string, SequenceData>(builder.hydratedSequences.map((s) => [s.id, s])),
  );
  function rowLabel(id: string): string {
    const seq = byId.get(id);
    return seq?.displayName ?? seq?.word ?? seq?.name ?? "Loading…";
  }
  function rowCount(id: string): number | null {
    return byId.get(id)?.steps.length ?? null;
  }

  const separatorOptions: { value: GroupSeparator; label: string }[] = [
    { value: "rule", label: "Line" },
    { value: "gap", label: "Gap" },
    { value: "none", label: "None" },
  ];

  // ── Add-sequences browse drawer ────────────────────────────────────────────
  // Renders the user's library through the canonical Browse grid/card
  // (ChoreoCardThumbnail → PropAwareThumbnail), so each option is a real
  // rendered pictograph model — not a stored strip thumbnail. Click a card and
  // it appends as a row (the sequence is already hydrated, so seed it directly).
  let browseOpen = $state(false);
  const thumbnailProvider = getBrowseThumbnailProvider();
  let libSequences = $state<SequenceData[]>([]);
  let browseLoading = $state(false);
  let browseError = $state<string | null>(null);
  let browseLoaded = false;
  let browseSearch = $state("");

  async function ensureLibraryLoaded(): Promise<void> {
    if (browseLoaded) return;
    browseLoaded = true;
    browseLoading = true;
    browseError = null;
    try {
      libSequences = (await getLibraryRepository().getSequences()) as SequenceData[];
    } catch (error) {
      browseLoaded = false; // let a re-open retry
      browseError = error instanceof Error ? error.message : "Failed to load sequences";
    } finally {
      browseLoading = false;
    }
  }

  function toggleBrowse(): void {
    browseOpen = !browseOpen;
    if (browseOpen) void ensureLibraryLoaded();
  }

  const filteredLibSequences = $derived.by(() => {
    const q = browseSearch.trim().toLowerCase();
    if (!q) return libSequences;
    return libSequences.filter((s) =>
      `${s.word ?? ""} ${s.name ?? ""} ${s.displayName ?? ""}`.toLowerCase().includes(q),
    );
  });

  let exporting = $state(false);
  let exportPct = $state(0);
  async function exportPdf() {
    if (builder.hydratedSequences.length === 0 || exporting) return;
    exporting = true;
    exportPct = 0;
    try {
      const filename = `${(sheetName || "choreo-sheet").trim().replace(/\s+/g, "-").toLowerCase()}.pdf`;
      await downloadChoreoSheetPDF(
        { ...builder.sheet, name: sheetName },
        builder.hydratedSequences,
        filename,
        (done, total) => {
          exportPct = total > 0 ? Math.round((done / total) * 100) : 0;
        },
      );
    } finally {
      exporting = false;
    }
  }

  let saving = $state(false);
  let saveMessage = $state<string | null>(null);
  async function save() {
    if (saving) return;
    saving = true;
    saveMessage = null;
    try {
      await getChoreoSheetRepository().saveSheet({ ...builder.sheet, name: sheetName });
      saveMessage = "Saved";
    } catch (error) {
      saveMessage = error instanceof Error ? error.message : "Save failed";
    } finally {
      saving = false;
    }
  }
</script>

<div class="choreo-sheet-view">
  <!-- Toolbar: name + primary actions -->
  <header class="sheet-toolbar">
    <input
      class="name-input"
      type="text"
      bind:value={sheetName}
      aria-label="Sheet name"
      placeholder="Untitled Sheet"
    />
    <div class="toolbar-actions">
      <button type="button" class="btn" class:active={browseOpen} onclick={toggleBrowse}>
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        Add sequences
      </button>
      <button type="button" class="btn" onclick={save} disabled={saving || builder.sequenceIds.length === 0}>
        <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        onclick={exportPdf}
        disabled={exporting || builder.hydratedSequences.length === 0}
      >
        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
        {exporting ? `Exporting ${exportPct}%` : "Export PDF"}
      </button>
    </div>
    {#if saveMessage}
      <span class="save-message">{saveMessage}</span>
    {/if}
  </header>

  <div class="sheet-body">
    <!-- Left rail: row list + layout settings -->
    <aside class="rail">
      <section class="rail-block">
        <h2 class="rail-title">Sequences ({builder.sequenceIds.length})</h2>
        {#if builder.sequenceIds.length === 0}
          <p class="rail-empty">No sequences yet. Add some to build the sheet.</p>
        {:else}
          <ul class="row-list">
            {#each builder.sequenceIds as id, i (id)}
              <li class="row-item" animate:flip={{ duration: 200 }}>
                <span class="row-label" title={rowLabel(id)}>{rowLabel(id)}</span>
                {#if rowCount(id) != null}
                  <span class="row-count">{rowCount(id)}</span>
                {/if}
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    aria-label="Move up"
                    disabled={i === 0}
                    onclick={() => builder.move(i, i - 1)}
                  >
                    <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    aria-label="Move down"
                    disabled={i === builder.sequenceIds.length - 1}
                    onclick={() => builder.move(i, i + 1)}
                  >
                    <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn-danger"
                    aria-label="Remove from sheet"
                    onclick={() => builder.removeAt(i)}
                  >
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="rail-block">
        <h2 class="rail-title">Layout</h2>
        <div class="setting-row">
          <span class="setting-label">Step numbers</span>
          <button
            type="button"
            class="toggle"
            role="switch"
            aria-checked={builder.layout.showStepNumbers}
            aria-label="Toggle step numbers"
            onclick={() => builder.setLayout({ showStepNumbers: !builder.layout.showStepNumbers })}
          >
            <span class="toggle-track" class:on={builder.layout.showStepNumbers}>
              <span class="toggle-thumb"></span>
            </span>
          </button>
        </div>
        <div class="setting-col">
          <span class="setting-label">Group separator</span>
          <SegmentedControl
            options={separatorOptions}
            value={builder.layout.groupSeparator}
            onchange={(v) => builder.setLayout({ groupSeparator: v })}
            color="accent"
            size="sm"
          />
        </div>
      </section>
    </aside>

    <!-- Preview -->
    <div class="preview-pane">
      {#if builder.isHydrating && builder.hydratedSequences.length === 0}
        <p class="preview-status">Loading sequences…</p>
      {/if}
      <SheetPreviewPages pages={builder.pages} geo={builder.geo} layout={builder.layout} />
    </div>
  </div>
</div>

{#if browseOpen}
  <!-- Canonical Browse grid (ChoreoCardThumbnail → PropAwareThumbnail): each
       option is a real rendered pictograph model. Click a card → adds a row. -->
  <button
    type="button"
    class="browse-scrim"
    aria-label="Close sequence browser"
    onclick={() => (browseOpen = false)}
  ></button>
  <aside class="browse-drawer" aria-label="Add sequences">
    <div class="browse-drawer-head">
      <span class="browse-drawer-title">Add sequences — tap to add a row</span>
      <button
        type="button"
        class="browse-close"
        aria-label="Close browser"
        onclick={() => (browseOpen = false)}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
    <div class="browse-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input
        type="text"
        bind:value={browseSearch}
        placeholder="Search your sequences"
        aria-label="Search your sequences"
      />
    </div>
    <div class="browse-grid-scroll">
      {#if browseLoading}
        <p class="browse-status">Loading your sequences…</p>
      {:else if browseError}
        <p class="browse-status">{browseError}</p>
      {:else if filteredLibSequences.length === 0}
        <p class="browse-status">
          {libSequences.length === 0 ? "No sequences in your library yet." : "No matches."}
        </p>
      {:else}
        <BrowseGrid
          sequences={filteredLibSequences}
          thumbnailService={thumbnailProvider}
          eager
          disableVirtualization
          onAction={(_action, seq) => builder.addHydratedSequences([seq])}
        />
      {/if}
    </div>
  </aside>
{/if}

<style>
  .choreo-sheet-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: var(--spacing-sm);
  }

  .sheet-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .name-input {
    flex: 1;
    min-width: 160px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-base, 1rem);
    font-weight: 600;
  }

  .name-input:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  .toolbar-actions {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--duration-fast, 0.12s) ease;
  }

  .btn:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
  }

  .btn-primary {
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: var(--theme-text-on-accent, #fff);
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: var(--theme-text-on-accent, #fff);
  }

  /* Right-docked drawer: search + canonical Browse grid of pictograph cards. */
  .browse-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    padding: 0;
    cursor: pointer;
    z-index: 40;
  }

  .browse-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 92vw);
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, #14141c);
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
    z-index: 41;
  }

  .browse-drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .browse-drawer-title {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .browse-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
  }

  .browse-close:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .browse-search {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: var(--spacing-sm) var(--spacing-md) 0;
    padding: 0 var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    flex-shrink: 0;
  }

  .browse-search input {
    flex: 1;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    background: none;
    border: none;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .browse-search input:focus {
    outline: none;
  }

  .browse-grid-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  }

  .browse-status {
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 0.875rem);
    margin: var(--spacing-md) 0;
  }

  .save-message {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .sheet-body {
    flex: 1;
    display: flex;
    gap: var(--spacing-sm);
    min-height: 0;
  }

  .rail {
    flex-shrink: 0;
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    overflow-y: auto;
    padding-right: var(--spacing-xs);
  }

  .rail-title {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 var(--spacing-xs);
  }

  .rail-empty {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .row-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .row-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-xs) 0 var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
  }

  .row-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text, #fff);
  }

  .row-count {
    flex-shrink: 0;
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 1.5rem;
    text-align: right;
  }

  .row-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-btn-danger:hover:not(:disabled) {
    color: var(--theme-danger, #ef4444);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    min-height: var(--min-touch-target, 44px);
  }

  .setting-col {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .setting-label {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text, #fff);
  }

  /* Button + sliding indicator toggle (design system — never a checkbox). */
  .toggle {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    min-height: var(--min-touch-target, 44px);
  }

  .toggle-track {
    width: 44px;
    height: 26px;
    border-radius: 9999px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.2));
    position: relative;
    transition: background-color var(--duration-fast, 0.12s) ease;
  }

  .toggle-track.on {
    background: var(--theme-accent, #6366f1);
  }

  .toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--duration-fast, 0.12s) ease;
  }

  .toggle-track.on .toggle-thumb {
    transform: translateX(18px);
  }

  .preview-pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    background: var(--theme-bg-subtle, rgba(0, 0, 0, 0.2));
    border-radius: 8px;
    padding: var(--spacing-sm);
  }

  .preview-status {
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 0.875rem);
  }

  @media (max-width: 768px) {
    .sheet-body {
      flex-direction: column;
    }
    .rail {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-track,
    .toggle-thumb,
    .btn {
      transition: none;
    }
  }
</style>
