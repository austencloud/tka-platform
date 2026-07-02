<!--
  ChoreoSheetView.svelte

  The choreo-sheet builder surface inside the Write module. Pick sequences →
  reorder/remove rows → tune layout (step numbers, block separator) → see the
  live landscape preview → export a print-ready PDF (and save the sheet).

  Owns the builder state (createChoreoSheetState) and sets the context so any
  descendant can read it. Sequences are added via the Browse drawer (additive —
  removal/reorder happen here in the row list); the picker, preview, and PDF all
  read the same planned pages, so what you see is what prints.

  The builder auto-saves to localStorage and restores on reload/HMR, so the view
  always comes back in the exact state it was left.
-->
<script lang="ts">
  import { flip } from "svelte/animate";
  import { onMount } from "svelte";
  import {
    createChoreoSheetState,
    setChoreoSheetContext,
  } from "../../state/choreo-sheet-state.svelte";
  import { getChoreoSheetRepository } from "../../services/choreo-sheet-repository";
  import { downloadChoreoSheetPDF } from "../../services/sheet-pdf-exporter";
  import type { ChoreoSheet, GroupSeparator } from "../../domain/types/choreo-sheet";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import SheetPreviewPages from "./SheetPreviewPages.svelte";
  import ActPlayer from "./ActPlayer.svelte";
  import ActsDock from "./ActsDock.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
  import CollectionChipsRow from "$lib/features/library/components/collection-picker/CollectionChipsRow.svelte";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";

  // Hydrates one sequence id when a draft/saved act restores. Order matters:
  // most rows on a sheet are the user's OWN sequences, and the public gallery
  // loader can never see private library docs — routing everything through it
  // was the bug that made rows show "Failed to load" after navigating away and
  // back. So: private library first, public/community gallery as the fallback.
  async function loadSheetSequence(id: string): Promise<SequenceData | null> {
    let own: SequenceData | null = null;
    try {
      // steps can be undefined at runtime: the library mapper only sets
      // `steps` when the doc carries a steps array, and compositional docs
      // whose hydration failed come back without one. Never trust the typed
      // shape here — `own.steps.length` on undefined was itself a bug that
      // turned an existing sequence into "Failed to load".
      own = await getLibraryRepository().getSequence(id);
      if (own && (own.steps?.length ?? 0) > 0) return own;
    } catch {
      // Signed out or a library fetch failure — the public path below may
      // still resolve community ids.
    }
    const pub = await getBrowseLoader().loadFullSequenceData(id, id);
    if (pub && (pub.steps?.length ?? 0) > 0) return pub;
    // Neither path produced steps. Prefer returning SOMETHING found over a
    // false "Failed to load": the row then shows its real name (with zero
    // cells) instead of claiming the sequence is gone. Normalize steps to []
    // so downstream planners/counters never read .length off undefined.
    const found = pub ?? own;
    if (!found) {
      // Terminal miss: name the id and both paths so a bug report carries
      // everything needed (row tooltip shows the same id).
      console.warn(
        `[ChoreoSheet] Sequence "${id}" not found in your library or the ` +
          `community gallery. It may have been deleted or renamed. ` +
          `Retry the row, or remove it from the sheet.`,
      );
      return null;
    }
    return { ...found, steps: found.steps ?? [] };
  }

  // Builder-state object. The sheet auto-saves to localStorage (persistKey) and
  // restores on reload/HMR.
  const builder = createChoreoSheetState({
    loadSequence: loadSheetSequence,
    persistKey: "tka-choreo-sheet-draft",
  });
  setChoreoSheetContext({ state: builder });

  // id → hydrated sequence, for the row list labels/counts. Ids still hydrating
  // simply show "Loading…" until their data resolves.
  const byId = $derived(
    new Map<string, SequenceData>(builder.hydratedSequences.map((s) => [s.id, s])),
  );
  function rowLabel(id: string): string {
    const seq = byId.get(id);
    if (seq) return seq.displayName ?? seq.word ?? seq.name ?? "Untitled";
    return builder.failedSequenceIds.has(id) ? "Failed to load" : "Loading…";
  }
  // Tooltip: failed rows carry the id + what to do, so "Failed to load" is
  // never a dead end (and a screenshot of the tooltip identifies the doc).
  function rowTitle(id: string): string {
    if (!builder.failedSequenceIds.has(id)) return rowLabel(id);
    return (
      `Couldn't find "${id}" in your library or the community gallery. ` +
      `It may have been deleted. Retry, or remove it from the sheet.`
    );
  }
  function rowCount(id: string): number | null {
    return byId.get(id)?.steps?.length ?? null;
  }

  const separatorOptions: { value: GroupSeparator; label: string }[] = [
    { value: "rule", label: "Line" },
    { value: "gap", label: "Gap" },
    { value: "none", label: "None" },
  ];

  // ── Add-sequences picker (inline docked column) ─────────────────────────────
  // Reuses the full Browse experience (BrowsePanel + a browse engine): real
  // rendered pictograph cards, filter sheet, sort, virtualization. Sources are
  // the two POOLS (My Library | Community — the toolbar toggle); collections
  // organize the library, so they surface as the chips row above the grid
  // (CollectionChipsRow → the engine's COLLECTION filter). Open state and the
  // engine's source/sort/filters persist across reload/HMR so the picker
  // reopens exactly as it was left.
  const PICKER_PREFS_KEY = "tka-choreo-sheet-picker-ui";
  interface PickerPrefs {
    open: boolean;
    playerOpen: boolean;
    actsOpen: boolean;
  }
  function loadPickerPrefs(): PickerPrefs {
    const fallback: PickerPrefs = {
      open: false,
      playerOpen: false,
      actsOpen: false,
    };
    if (typeof localStorage === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(PICKER_PREFS_KEY);
      if (!raw) return fallback;
      const p = JSON.parse(raw) as Partial<PickerPrefs>;
      return {
        open: !!p.open,
        playerOpen: !!p.playerOpen,
        actsOpen: !!p.actsOpen,
      };
    } catch {
      return fallback;
    }
  }
  const initialPrefs = loadPickerPrefs();

  let browseOpen = $state(initialPrefs.open);
  let browseInitialized = false;
  // Grid chrome follows the gallery grammar: Filters pill → shared drill sheet
  // (search included there), no toolbar magnifier, no inline dropdown chips.
  let pickerFilterSheetOpen = $state(false);
  let pickerSideBySide = $state(false);
  onMount(() => {
    pickerSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    const unsubscribe = responsiveLayoutManager.onLayoutChange(() => {
      pickerSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    });
    return unsubscribe;
  });
  let playerOpen = $state(initialPrefs.playerOpen);
  let actsOpen = $state(initialPrefs.actsOpen);

  const browseEngine = createBrowseEngine({
    // Persists source/sort/filters/columns across reload; BrowsePanel persists its
    // own scroll via browseScrollState.
    persistKey: "tka-choreo-sheet-picker",
    initialSource: "my-library",
    minColumns: 2,
  });

  function initEngineOnce(): void {
    if (browseInitialized) return;
    browseInitialized = true;
    browseEngine.initialize();
  }

  onMount(() => {
    // Restore: if the picker was left open, bring its data back up immediately.
    if (browseOpen) initEngineOnce();
    return () => browseEngine.destroy();
  });

  // Persist picker UI state on every change (the engine persists its own
  // source/sort/filters under its persistKey).
  $effect(() => {
    const prefs: PickerPrefs = {
      open: browseOpen,
      playerOpen,
      actsOpen,
    };
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(PICKER_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* private-mode / quota — non-fatal */
    }
  });

  function toggleBrowse(): void {
    browseOpen = !browseOpen;
    if (!browseOpen) return;
    playerOpen = false; // docks are mutually exclusive — keep the page readable
    actsOpen = false;
    initEngineOnce();
  }

  function togglePlayer(): void {
    playerOpen = !playerOpen;
    if (playerOpen) {
      browseOpen = false;
      actsOpen = false;
    }
  }

  function toggleActs(): void {
    actsOpen = !actsOpen;
    if (actsOpen) {
      browseOpen = false;
      playerOpen = false;
    }
  }

  // BrowsePanel emits a metadata-only SequenceData on select, so hydrate its
  // steps (library first, public fallback — same path the draft restore uses)
  // before adding — otherwise the row draws blank.
  async function handleBrowseSelect(seq: SequenceData): Promise<void> {
    try {
      const full = await loadSheetSequence(seq.id);
      builder.addHydratedSequences([full ?? seq]);
    } catch (err) {
      console.warn("[ChoreoSheetView] Failed to hydrate selected sequence:", err);
      builder.addHydratedSequences([seq]);
    }
  }


  let exporting = $state(false);
  let exportPct = $state(0);
  async function exportPdf() {
    if (builder.hydratedSequences.length === 0 || exporting) return;
    exporting = true;
    exportPct = 0;
    try {
      const filename = `${(builder.sheet.name || "choreo-sheet").trim().replace(/\s+/g, "-").toLowerCase()}.pdf`;
      await downloadChoreoSheetPDF(
        builder.sheet,
        builder.normalizedRows,
        filename,
        (done, total) => {
          exportPct = total > 0 ? Math.round((done / total) * 100) : 0;
        },
        builder.breakSequenceIds,
      );
    } finally {
      exporting = false;
    }
  }

  let saving = $state(false);
  let saveMessage = $state<string | null>(null);
  // Success feedback happens ON the Save button itself: it briefly turns
  // success-green with a check + "Saved", then settles back. saveMessage is
  // reserved for errors.
  let saveFlash = $state(false);
  let saveFlashTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => () => {
    if (saveFlashTimer) clearTimeout(saveFlashTimer);
  });

  // ── Saved acts (dock) ────────────────────────────────────────────────────────
  // Dirty = the sheet has content the cloud hasn't seen: either it was never
  // saved/loaded this session (null stamp) or it was edited after the last sync.
  // Every builder mutation bumps sheet.updatedAt, so the comparison is exact.
  let lastSyncedAt = $state<number | null>(null);
  const dirty = $derived(
    builder.sequenceIds.length > 0 &&
      (lastSyncedAt === null || builder.sheet.updatedAt.getTime() > lastSyncedAt),
  );
  // Bumped on every successful save so the acts dock refetches (the saved act
  // re-sorts to the top with a fresh timestamp).
  let saveRefreshKey = $state(0);

  async function save(): Promise<boolean> {
    if (saving) return false;
    saving = true;
    saveMessage = null;
    try {
      await getChoreoSheetRepository().saveSheet(builder.sheet);
      lastSyncedAt = Date.now();
      saveRefreshKey += 1;
      saveFlash = true;
      if (saveFlashTimer) clearTimeout(saveFlashTimer);
      saveFlashTimer = setTimeout(() => (saveFlash = false), 1600);
      return true;
    } catch (error) {
      saveMessage = error instanceof Error ? error.message : "Save failed";
      return false;
    } finally {
      saving = false;
    }
  }

  function openAct(act: ChoreoSheet): void {
    builder.replaceSheet(act);
    lastSyncedAt = Date.now(); // freshly loaded = in sync with the cloud copy
    saveMessage = null;
  }

  function newAct(): void {
    builder.newSheet();
    lastSyncedAt = null;
    saveMessage = null;
  }

  // Deleting the act that's open leaves the builder holding an unsaved draft.
  function handleActDeleted(id: string): void {
    if (id === builder.sheet.id) {
      lastSyncedAt = null;
      saveMessage = null;
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && builder.selectedSequenceId) builder.clearSelection();
  }}
/>

<div class="choreo-sheet-view">
  <!-- Toolbar: name + primary actions -->
  <header class="sheet-toolbar">
    <input
      class="name-input"
      type="text"
      value={builder.sheet.name}
      oninput={(e) => builder.setName(e.currentTarget.value)}
      aria-label="Sheet name"
      placeholder="Untitled Sheet"
    />
    <div class="toolbar-actions">
      <button
        type="button"
        class="btn btn-acts"
        class:active={actsOpen}
        onclick={toggleActs}
      >
        <i class="fa-solid fa-clapperboard" aria-hidden="true"></i>
        Acts
      </button>
      <button type="button" class="btn" class:active={browseOpen} onclick={toggleBrowse}>
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        Add sequences
      </button>
      <button
        type="button"
        class="btn"
        class:active={playerOpen}
        onclick={togglePlayer}
        disabled={builder.sequenceIds.length === 0}
      >
        <i class="fa-solid fa-play" aria-hidden="true"></i>
        Play act
      </button>
      <button
        type="button"
        class="btn btn-save"
        class:success={saveFlash}
        onclick={() => void save()}
        disabled={saving || builder.sequenceIds.length === 0}
        title={dirty ? "Unsaved changes" : undefined}
      >
        <Crossfade key={saveFlash}>
          {#if saveFlash}
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          {:else}
            <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
          {/if}
        </Crossfade>
        <span class="btn-label">
          <span class="btn-label-sizer" aria-hidden="true">Saving…</span>
          <span class="btn-label-live">
            {saving ? "Saving…" : saveFlash ? "Saved" : "Save"}
          </span>
        </span>
        <span class="unsaved-dot" class:show={dirty} aria-hidden="true"></span>
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
    {#if builder.sequenceIds.length > 0}
      <span
        class="loop-badge"
        class:loops={builder.loopStatus === "loops"}
        class:open={builder.loopStatus === "open"}
        title={builder.loopStatus === "loops"
          ? "The sheet ends where it began — it loops."
          : "The sheet ends at a different state than it began."}
      >
        <span class="loop-sizer" aria-hidden="true">Loops ✓</span>
        <span class="loop-live">
          {#if builder.loopStatus === "loops"}Loops ✓{:else}Open{/if}
        </span>
      </span>
    {/if}
    {#if saveMessage}
      <span class="save-message" role="alert">{saveMessage}</span>
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
              <li
                class="row-item"
                class:selected={builder.selectedSequenceId === id}
                animate:flip={{ duration: 200 }}
              >
                <button
                  type="button"
                  class="row-label"
                  title={rowTitle(id)}
                  aria-pressed={builder.selectedSequenceId === id}
                  onclick={() => builder.toggleSequenceSelection(id)}
                >
                  {rowLabel(id)}
                </button>
                {#if rowCount(id) != null}
                  <span class="row-count">{rowCount(id)}</span>
                {/if}
                <div class="row-actions">
                  {#if builder.failedSequenceIds.has(id)}
                    <button
                      type="button"
                      class="icon-btn row-retry"
                      aria-label="Sequence failed to load — retry"
                      title="This sequence failed to load. Tap to retry."
                      onclick={() => void builder.retryHydration(id)}
                    >
                      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
                    </button>
                  {/if}
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
      <SheetPreviewPages
        pages={builder.pages}
        geo={builder.geo}
        layout={builder.layout}
        breakSequenceIds={builder.breakSequenceIds}
        selectedSequenceId={builder.selectedSequenceId}
        onSelectSequence={(id) => builder.toggleSequenceSelection(id)}
        onRemoveSequence={(id) => builder.removeById(id)}
      />
    </div>

    {#if browseOpen}
      <!-- Inline docked picker. The page stays fully visible (preview just
           narrows) instead of being covered by an overlay. -->
      <aside class="browse-dock" aria-label="Add sequences">
        <div class="browse-drawer-head">
          <span class="browse-drawer-title">Add sequences — tap a card to add a row</span>
          <button
            type="button"
            class="browse-close"
            aria-label="Close browser"
            onclick={() => (browseOpen = false)}
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Collections lead the grid as chips: yours on My Library, followed
             ones on Community — the row's count gate routes per pool. Sources
             are the toolbar's standard Community | My Library toggle. -->
        <CollectionChipsRow engine={browseEngine} />

        <div class="browse-panel-host">
          <BrowsePanel
            engine={browseEngine}
            layout="compact"
            showSourceToggle
            onSelect={(seq) => handleBrowseSelect(seq)}
            hideToolbarSearch
            onOpenFilters={() => (pickerFilterSheetOpen = true)}
          />
        </div>
      </aside>

      <GalleryFilterSheet
        engine={browseEngine}
        bind:isOpen={pickerFilterSheetOpen}
        isMobile={!pickerSideBySide}
      />
    {/if}

    {#if actsOpen}
      <!-- Saved acts: create / open / delete, same inline-dock pattern as the
           picker so the two surfaces feel like one design. -->
      <ActsDock
        currentActId={builder.sheet.id}
        currentActName={builder.sheet.name}
        {dirty}
        refreshKey={saveRefreshKey}
        onOpenAct={openAct}
        onNewAct={newAct}
        onSaveCurrent={save}
        onDeleted={handleActDeleted}
        onClose={() => (actsOpen = false)}
      />
    {/if}

    {#if playerOpen}
      <ActPlayer sequence={builder.actSequence} onClose={() => (playerOpen = false)} />
    {/if}
  </div>
</div>

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
    transition:
      background-color var(--duration-fast, 0.12s) ease,
      border-color var(--duration-fast, 0.12s) ease,
      color var(--duration-fast, 0.12s) ease,
      transform var(--duration-fast, 0.12s) ease;
  }

  .btn:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
  }

  /* Press physics: every toolbar action gives a small tactile dip. */
  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn i {
    transition: transform var(--duration-normal, 0.2s) cubic-bezier(0.34, 1.56, 0.64, 1);
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

  /* The clapperboard tips open while the Acts dock is open. */
  .btn-acts.active i {
    transform: rotate(-12deg);
  }

  /* Ghost-sizer keeps the Save button's width fixed while the label swaps
     between "Save" and "Saving…" (no-layout-shift). */
  .btn-save {
    position: relative;
  }

  /* Success morph: the button itself confirms the save — green tint, check
     icon (crossfaded), "Saved" — then settles back after 1.6s. */
  .btn-save.success {
    border-color: color-mix(in srgb, var(--theme-success, #22c55e) 60%, transparent);
    color: var(--theme-success, #22c55e);
    background: color-mix(
      in srgb,
      var(--theme-success, #22c55e) 12%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.06))
    );
  }

  .btn-label {
    display: inline-grid;
    justify-items: center;
  }

  .btn-label-sizer,
  .btn-label-live {
    grid-area: 1 / 1;
    white-space: nowrap;
  }

  .btn-label-sizer {
    visibility: hidden;
  }

  /* Unsaved-changes dot: absolutely positioned (reserves nothing, shifts
     nothing), eases in and breathes gently while changes are pending. */
  .unsaved-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    opacity: 0;
    transform: scale(0.4);
    transition:
      opacity var(--duration-fast, 0.12s) ease,
      transform var(--duration-normal, 0.2s) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .unsaved-dot.show {
    opacity: 1;
    transform: scale(1);
    animation: unsaved-breathe 2.4s ease-in-out infinite;
  }

  @keyframes unsaved-breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }

  /* Inline docked picker column — sits beside the preview so the whole page
     stays visible (the preview just narrows). Not an overlay. */
  .browse-dock {
    flex-shrink: 0;
    width: min(460px, 42vw);
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--theme-panel-bg, #14141c);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    overflow: hidden;
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

  .browse-panel-host {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Errors only — success feedback lives on the Save button itself. */
  .save-message {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-danger, #ef4444);
  }

  /* Loop status. Ghost-sizer keeps the pill width fixed so the toolbar never
     shifts as the word changes (no-layout-shift). */
  .loop-badge {
    display: inline-grid;
    align-items: center;
    padding: 2px 10px;
    border-radius: 9999px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    font-size: var(--font-size-compact, 0.72rem);
    font-weight: 700;
  }

  .loop-sizer,
  .loop-live {
    grid-area: 1 / 1;
  }

  .loop-sizer {
    visibility: hidden;
  }

  .loop-badge.loops .loop-live {
    color: var(--theme-success, #22c55e);
  }

  .loop-badge.open .loop-live {
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

  .row-item.selected {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 16%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.06))
    );
  }

  .row-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
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

  /* Failed-hydration retry on a row: danger-tinted so the row reads as broken. */
  .row-retry {
    color: var(--theme-danger, #ef4444);
  }

  .row-retry:hover:not(:disabled) {
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
    background: var(--theme-text, #fff);
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

  @media (max-width: 900px) {
    .sheet-body {
      flex-direction: column;
    }
    .rail {
      width: 100%;
    }
    .browse-dock {
      width: 100%;
      max-height: 45vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-track,
    .toggle-thumb,
    .btn,
    .btn i,
    .unsaved-dot {
      transition: none;
    }

    .unsaved-dot.show {
      animation: none;
    }

    .btn:active:not(:disabled) {
      transform: none;
    }

    .btn-acts.active i {
      transform: none;
    }
  }
</style>
