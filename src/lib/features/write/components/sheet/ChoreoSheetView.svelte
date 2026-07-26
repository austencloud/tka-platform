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
  import { onDestroy, onMount } from "svelte";
  import { SequenceSelection, setSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import "$lib/shared/selection/selection.css";
  import {
    createChoreoSheetState,
    setChoreoSheetContext,
    type RosterRow,
  } from "../../state/choreo-sheet-state.svelte";
  import { getChoreoSheetRepository } from "../../services/choreo-sheet-repository";
  import { createSheetSequenceResolver } from "../../services/sheet-sequence-resolver";
  import { awaitAuthSettled } from "$lib/shared/auth/state/auth-state.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import ShimmerBlock from "$lib/shared/components/loading/ShimmerBlock.svelte";
  import { downloadChoreoSheetPDF } from "../../services/sheet-pdf-exporter";
  import type {
    ChoreoSheet,
    GroupSeparator,
    SheetOrientation,
    SheetPacking,
  } from "../../domain/types/choreo-sheet";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import SheetPreviewPages from "./SheetPreviewPages.svelte";
  import ActPlayer from "./ActPlayer.svelte";
  import ActsDock from "./ActsDock.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { dockSlide } from "$lib/shared/transitions/dock-slide";
  import {
    flyFade,
    growFade,
    flipDuration,
  } from "$lib/shared/transitions/motion";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
  import CollectionChipsRow from "$lib/features/library/components/collection-picker/CollectionChipsRow.svelte";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { getCollectionSequences } from "$lib/shared/library/services/collection-manager";
  import { getUserCollectionSequences } from "$lib/features/library/services/public-collection-loader";
  import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
  import { communityCollectionsState } from "$lib/features/browse/collections/state/community-collections-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  // Resolves one sequence id when a draft/saved act restores. Order matters:
  // most rows on a sheet are the user's OWN sequences, and the public gallery
  // loader can never see private library docs — routing everything through it
  // was the bug that made rows show "Failed to load" after navigating away and
  // back. So: private library first, public/community gallery as the fallback.
  //
  // The resolver owns everything else that made a cold restore unreliable: it
  // waits for auth restoration to settle before touching the private tier (a
  // restored draft used to race Firebase and come back six rows of red), and it
  // classifies + auto-retries transient failures instead of presenting them as
  // deletions.
  const resolver = createSheetSequenceResolver({
    loadPrivate: (id) => getLibraryRepository().getSequence(id),
    loadPublic: (id) => getBrowseLoader().loadFullSequenceData(id, id),
    awaitAuthSettled,
  });

  // Builder-state object. The sheet auto-saves to localStorage (persistKey) and
  // restores on reload/HMR.
  const builder = createChoreoSheetState({
    resolveSequence: resolver.resolve,
    persistKey: "tka-choreo-sheet-draft",
  });
  setChoreoSheetContext({ state: builder });

  // Shared selection primitive. The builder stays the behavioural owner
  // (Remove / persistence / Escape); this scope mirrors its selectedId so the
  // whole-sequence selection ring + a11y match the guide by construction.
  const selection = new SequenceSelection();
  setSequenceSelection(selection);
  $effect(() => {
    selection.selectedId = builder.selectedSequenceId;
  });

  // Row labels come off the roster, so a row that is still loading shows its
  // real name from the draft's meta snapshot instead of the word "Loading…".
  // A repeating word ALWAYS displays in its smallest form (FΨ, not FΨFΨFΨFΨ) —
  // the raw word stays in the tooltip.
  function rowLabel(row: RosterRow): string {
    const raw = row.meta?.name;
    return raw ? simplifyRepeatedWord(raw) : "…";
  }
  // Tooltip: the raw (unsimplified) word, and for a row that didn't resolve, the
  // id + what to do — so a stuck row is never a dead end, and a screenshot of
  // the tooltip identifies the doc.
  function rowTitle(row: RosterRow): string {
    if (row.status === "missing") {
      return `"${row.id}" isn't in your library or the gallery. It may have been deleted — remove it from the sheet.`;
    }
    if (row.status === "error") {
      return "This sequence didn't load automatically. Tap to retry.";
    }
    return row.meta?.name ?? row.id;
  }

  const separatorOptions: { value: GroupSeparator; label: string }[] = [
    { value: "rule", label: "Line" },
    { value: "gap", label: "Gap" },
    { value: "none", label: "None" },
  ];

  // Study = the dense continuous-flow sheet (flow packing). Annotated = the
  // row-aligned sheet with a cue rail + note strips + page header.
  const packingOptions: { value: SheetPacking; label: string }[] = [
    { value: "flow", label: "Study (dense)" },
    { value: "aligned", label: "Annotated" },
  ];
  const orientationOptions: { value: SheetOrientation; label: string }[] = [
    { value: "landscape", label: "Landscape" },
    { value: "portrait", label: "Portrait" },
  ];
  type PictographSize = "large" | "standard" | "compact";
  const pictographSizeOptions: { value: PictographSize; label: string }[] = [
    { value: "large", label: "Large" },
    { value: "standard", label: "Standard" },
    { value: "compact", label: "Compact" },
  ];
  const isAnnotated = $derived(builder.layout.packing === "aligned");
  const pictographSize = $derived<PictographSize>(
    builder.layout.columns <= 4 ? "large" : builder.layout.columns <= 6 ? "standard" : "compact"
  );

  function setPictographSize(size: PictographSize): void {
    const geometry =
      size === "large"
        ? { columns: 4, rowsPerPage: 3 }
        : size === "standard"
          ? { columns: 6, rowsPerPage: 4 }
          : { columns: 8, rowsPerPage: 6 };
    builder.setLayout(geometry);
  }

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
  // Perf: the picker's gallery (virtualized grid) is too heavy to mount inside
  // the click frame — it cost a traced 254ms presentation delay and re-measured
  // itself every frame of the dock glide. The dock shell slides in immediately;
  // the heavy content mounts on introend, over a skeleton.
  let browseSettled = $state(false);
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
    // (No intro plays on initial mount — local transition — so settle now.)
    if (browseOpen) {
      browseSettled = true;
      initEngineOnce();
    }
    return () => browseEngine.destroy();
  });

  function settleBrowse(): void {
    browseSettled = true;
    initEngineOnce();
  }

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
    browseSettled = false;
    if (!browseOpen) return;
    playerOpen = false; // docks are mutually exclusive — keep the page readable
    actsOpen = false;
    // Engine init + gallery mount both wait for the dock's introend so the
    // glide gets the main thread to itself.
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
      const outcome = await resolver.resolve(seq.id, new AbortController().signal);
      builder.addHydratedSequences([outcome.sequence ?? seq]);
    } catch (err) {
      console.warn("[ChoreoSheetView] Failed to hydrate selected sequence:", err);
      builder.addHydratedSequences([seq]);
    }
  }

  let addingCollectionId = $state<string | null>(null);
  async function handleAddCollection(collectionId: string): Promise<void> {
    if (addingCollectionId) return;
    addingCollectionId = collectionId;

    try {
      const ownCollection = collectionsState.collections.find(
        (collection) => collection.id === collectionId
      );
      const communityCollection = communityCollectionsState.items.find(
        (item) => item.collection.id === collectionId
      );

      const isOwnSource = browseEngine.source === "my-library";
      const collectionName = isOwnSource
        ? ownCollection?.name
        : communityCollection?.collection.name;
      const sequences = isOwnSource
        ? await getCollectionSequences(collectionId)
        : communityCollection
          ? await getUserCollectionSequences(communityCollection.ownerId, collectionId)
          : [];

      if (!collectionName) {
        toast.error("That collection is no longer available.");
        return;
      }

      const existingIds = new Set(builder.sequenceIds);
      const additions = sequences.filter((sequence) => !existingIds.has(sequence.id));
      const wasEmpty = builder.sequenceIds.length === 0;
      builder.addHydratedSequences(sequences);

      if (wasEmpty && sequences.length > 0) {
        builder.setName(collectionName);
        // Whole-collection printing starts at the large, light sheet geometry.
        // The PDF exporter already renders every cell in light mode.
        setPictographSize("large");
      }

      if (additions.length === 0) {
        toast.info("That collection is already on this act.");
      } else {
        const noun = additions.length === 1 ? "sequence" : "sequences";
        toast.success(`Added ${additions.length} ${noun} from "${collectionName}".`);
      }
    } catch (error) {
      console.error("[ChoreoSheetView] Failed to add collection:", error);
      toast.error("Couldn't add that collection. Try again.");
    } finally {
      addingCollectionId = null;
    }
  }

  // The roster recovers on its own, so an error surface is EARNED, not eager:
  // it appears once, only after the automatic retries are spent and nothing is
  // still in flight. Keyed on the exact id set so a re-render never re-toasts.
  let reportedErrorIds = $state<string>("");
  $effect(() => {
    const errorIds = builder.roster.filter((r) => r.status === "error").map((r) => r.id);
    const key = errorIds.join(",");
    if (errorIds.length === 0 || key === reportedErrorIds || builder.isHydrating) return;
    reportedErrorIds = key;
    getErrorHandler().showUserError({
      message: `${errorIds.length} sequence${errorIds.length > 1 ? "s" : ""} didn't load — retry from the rail`,
      severity: "warning",
      context: { module: "choreo", tab: "sheet", action: "hydrate-roster" },
      technicalDetails: builder.roster
        .filter((r) => r.status !== "ready")
        .map((r) => `${r.id}: ${r.status}/${r.failure ?? "-"} after ${r.attempts}`)
        .join("\n"),
    });
  });

  const errorRowCount = $derived(builder.roster.filter((r) => r.status === "error").length);

  let exporting = $state(false);
  let exportPct = $state(0);
  async function exportPdf() {
    if (!builder.rosterComplete || builder.roster.length === 0 || exporting) return;
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
    } catch (error) {
      // Non-blocking toast rather than an inline strip: the toolbar must never
      // reflow because something failed.
      getErrorHandler().showUserError({
        message: "PDF export failed. Try again.",
        severity: "warning",
        context: { module: "choreo", tab: "sheet", action: "export-pdf" },
        technicalDetails: error instanceof Error ? error.message : String(error),
      });
    } finally {
      exporting = false;
    }
  }

  let saving = $state(false);
  // Success feedback happens ON the Save button itself: it briefly turns
  // success-green with a check + "Saved", then settles back. Failures go to the
  // toast surface, never an inline strip that reflows the toolbar.
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
    try {
      // Display meta rides along so a cold open on another device can label its
      // rows before hydration resolves. Steps still come from the library.
      const meta = Object.fromEntries(
        builder.roster.filter((r) => r.meta).map((r) => [r.id, r.meta!]),
      );
      await getChoreoSheetRepository().saveSheet(builder.sheet, meta);
      lastSyncedAt = Date.now();
      saveRefreshKey += 1;
      saveFlash = true;
      if (saveFlashTimer) clearTimeout(saveFlashTimer);
      saveFlashTimer = setTimeout(() => (saveFlash = false), 1600);
      return true;
    } catch (error) {
      getErrorHandler().showUserError({
        message: error instanceof Error ? error.message : "Save failed",
        severity: "warning",
        context: { module: "choreo", tab: "sheet", action: "save-sheet" },
        technicalDetails: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      return false;
    } finally {
      saving = false;
    }
  }

  function openAct(act: ChoreoSheet): void {
    builder.replaceSheet(act);
    lastSyncedAt = Date.now(); // freshly loaded = in sync with the cloud copy
  }

  function newAct(): void {
    builder.newSheet();
    lastSyncedAt = null;
  }

  // Deleting the act that's open leaves the builder holding an unsaved draft.
  function handleActDeleted(id: string): void {
    if (id === builder.sheet.id) lastSyncedAt = null;
  }

  // Leaving the view abandons any in-flight hydration: the resolver stops
  // mid-backoff instead of retrying against a builder nobody is watching.
  onDestroy(() => builder.cancelHydration());
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
        disabled={!builder.rosterComplete || builder.roster.length === 0}
        title={builder.rosterComplete ? undefined : "Waiting for sequences to load"}
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
        disabled={exporting || !builder.rosterComplete || builder.roster.length === 0}
        title={builder.rosterComplete ? undefined : "Waiting for sequences to load"}
      >
        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
        {exporting ? `Exporting ${exportPct}%` : "Export PDF"}
      </button>
    </div>
    {#if builder.sequenceIds.length > 0}
      <span
        transition:growFade={{ axis: "x" }}
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
  </header>

  <div class="sheet-body">
    <!-- Left rail: row list + layout settings -->
    <aside class="rail">
      <section class="rail-block">
        <div class="rail-head">
          <h2 class="rail-title">Sequences ({builder.sequenceIds.length})</h2>
          {#if errorRowCount >= 2}
            <button
              type="button"
              class="retry-all"
              onclick={() => void builder.retryHydration()}
            >
              <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
              Retry all
            </button>
          {/if}
        </div>
        <Crossfade key={builder.sequenceIds.length === 0}>
          {#if builder.sequenceIds.length === 0}
            <p class="rail-empty">No sequences yet. Add some to build the sheet.</p>
          {:else}
          <ul class="row-list">
            {#each builder.roster as row, i (row.id)}
              <li
                class="row-item"
                class:selected={builder.selectedSequenceId === row.id}
                class:missing={row.status === "missing"}
                animate:flip={{ duration: flipDuration() }}
                in:growFade={{ axis: "y", x: -8 }}
                out:growFade={{ axis: "y" }}
              >
                <button
                  type="button"
                  class="row-label tka-font"
                  title={rowTitle(row)}
                  aria-pressed={builder.selectedSequenceId === row.id}
                  onclick={() => builder.toggleSequenceSelection(row.id)}
                >
                  {rowLabel(row)}
                </button>
                <span class="row-count">{row.meta?.stepCount ?? ""}</span>
                <!-- Status slot: ALWAYS mounted, always the same width. Its
                     contents change with the row's state, so recovery never
                     reflows the rail. -->
                <span
                  class="row-status"
                  class:show={row.status !== "ready"}
                  aria-hidden={row.status === "ready"}
                >
                  {#if row.status === "loading" || row.status === "retrying"}
                    <ShimmerBlock circle height="14px" />
                  {:else if row.status === "error"}
                    <button
                      type="button"
                      class="icon-btn row-retry"
                      aria-label="Didn't load — retry"
                      title="This sequence didn't load automatically. Tap to retry."
                      onclick={() => void builder.retryHydration(row.id)}
                    >
                      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
                    </button>
                  {:else if row.status === "missing"}
                    <i
                      class="fa-solid fa-circle-question row-missing"
                      title="Not in your library or the gallery."
                      aria-label="Not in your library or the gallery"
                    ></i>
                  {/if}
                </span>
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
                    disabled={i === builder.roster.length - 1}
                    onclick={() => builder.move(i, i + 1)}
                  >
                    <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn-danger"
                    class:emphasised={row.status === "missing"}
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
        </Crossfade>
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
        <div class="setting-col">
          <span class="setting-label">Sheet style</span>
          <SegmentedControl
            options={packingOptions}
            value={builder.layout.packing}
            onchange={(v) => builder.setLayout({ packing: v })}
            color="accent"
            size="sm"
          />
        </div>
        <div class="setting-col">
          <span class="setting-label">Pictograph size</span>
          <SegmentedControl
            options={pictographSizeOptions}
            value={pictographSize}
            onchange={setPictographSize}
            color="accent"
            size="sm"
          />
        </div>
        {#if isAnnotated}
          <div class="setting-col" transition:growFade={{ axis: "y" }}>
            <span class="setting-label">Orientation</span>
            <SegmentedControl
              options={orientationOptions}
              value={builder.layout.orientation}
              onchange={(v) => builder.setLayout({ orientation: v })}
              color="accent"
              size="sm"
            />
          </div>
          <div
            class="setting-col"
            transition:growFade={{ axis: "y", duration: 240, delay: 40 }}
          >
            <span class="setting-label">Annotations</span>
            <div class="chip-row">
              <FilterChipBase
                label="Cue rail"
                icon="fa-solid fa-clock"
                mode="toggle"
                size="sm"
                active={builder.layout.showCueRail}
                onclick={() => builder.setLayout({ showCueRail: !builder.layout.showCueRail })}
              />
              <FilterChipBase
                label="Note strips"
                icon="fa-solid fa-note-sticky"
                mode="toggle"
                size="sm"
                active={builder.layout.showNoteStrips}
                onclick={() =>
                  builder.setLayout({ showNoteStrips: !builder.layout.showNoteStrips })}
              />
            </div>
          </div>
          {#if builder.layout.showCueRail}
            <div class="setting-col" transition:growFade={{ axis: "y" }}>
              <span class="setting-label">Timestamps</span>
              <div class="bpm-row">
                <input
                  class="bpm-input"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  value={builder.sheet.bpm ?? ""}
                  oninput={(e) => {
                    const n = Number(e.currentTarget.value);
                    if (Number.isFinite(n) && n > 0) builder.setBpm(n);
                  }}
                  aria-label="Beats per minute"
                  placeholder="BPM"
                />
                <button
                  type="button"
                  class="btn btn-prefill"
                  onclick={() => builder.prefillTimestamps()}
                  disabled={!builder.sheet.bpm || builder.sheet.bpm <= 0}
                  title="Fill blank cue timestamps from the BPM (1 step = 1 beat)"
                >
                  <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                  Prefill timestamps
                </button>
              </div>
            </div>
          {/if}
        {/if}
      </section>
    </aside>

    <!-- Preview -->
    <div class="preview-pane">
      <SheetPreviewPages
        placeholderRoster={builder.rosterComplete
          ? undefined
          : builder.roster.map((r) => ({ stepCount: r.meta?.stepCount ?? null }))}
        pages={builder.pages}
        geo={builder.geo}
        layout={builder.layout}
        breakSequenceIds={builder.breakSequenceIds}
        selectedSequenceId={builder.selectedSequenceId}
        onSelectSequence={(id) => builder.toggleSequenceSelection(id)}
        onRemoveSequence={(id) => builder.removeById(id)}
        bandPages={builder.bandPages}
        annotations={builder.sheet.annotations}
        sheetName={builder.sheet.name}
        onSetCue={builder.setCue}
        onAddNote={builder.addNote}
        onSetNote={builder.setNote}
        onRemoveNote={builder.removeNote}
        onSetHeader={builder.setHeader}
      />
    </div>

    {#if browseOpen}
      <!-- Inline docked picker. The page stays fully visible (preview just
           narrows) instead of being covered by an overlay. -->
      <aside
        class="browse-dock"
        aria-label="Add sequences"
        transition:dockSlide
        onintroend={settleBrowse}
      >
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

        {#if browseSettled}
          <!-- Collections lead the grid as chips: yours on My Library, every
               public collection on Community. The row's count gate routes per pool. Sources
               are the toolbar's standard Community | My Library toggle. -->
          <CollectionChipsRow
            engine={browseEngine}
            onAddCollection={(collectionId) => void handleAddCollection(collectionId)}
            addCollectionBusy={addingCollectionId !== null}
          />

          <div class="browse-panel-host" in:flyFade={{ duration: 150 }}>
            <BrowsePanel
              engine={browseEngine}
              layout="compact"
              showSourceToggle
              onSelect={(seq) => handleBrowseSelect(seq)}
              hideToolbarSearch
              onOpenFilters={() => (pickerFilterSheetOpen = true)}
            />
          </div>
        {:else}
          <!-- Skeleton mirroring the real dock layout (chips row, toolbar, card
               grid) so the settle swap doesn't jump. -->
          <div class="dock-skeleton" aria-hidden="true">
            <div class="dock-skel-row"></div>
            <div class="dock-skel-row dock-skel-toolbar"></div>
            <div class="dock-skel-grid">
              {#each { length: 6 } as _, i (i)}
                <div class="dock-skel-card" style="animation-delay: {i * 70}ms"></div>
              {/each}
            </div>
          </div>
        {/if}
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

  /* dockSlide perf contract: pin children at the dock's final width so the
     width animation is a pure clip-reveal — without this, the virtualized
     gallery re-measures itself every frame (traced at 180ms+ of reflow). */
  .browse-dock > :global(*) {
    width: min(460px, 42vw);
  }

  .dock-skeleton {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    overflow: hidden;
  }

  .dock-skel-row {
    height: 36px;
    flex-shrink: 0;
    border-radius: 18px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    animation: dock-skel-pulse 1.1s ease-in-out infinite;
  }

  .dock-skel-toolbar {
    border-radius: 8px;
  }

  .dock-skel-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    align-content: start;
    overflow: hidden;
  }

  .dock-skel-card {
    aspect-ratio: 1;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    animation: dock-skel-pulse 1.1s ease-in-out infinite;
  }

  @keyframes dock-skel-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
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
    /* Scrim: the live background bleeds through otherwise, so headings and the
       empty-state copy fight swimming fish. Backdrop-blur mutes that detail
       while keeping ambient color; the translucent panel lifts contrast. */
    padding: var(--spacing-sm);
    background: color-mix(in srgb, var(--theme-panel-bg, #14141c) 55%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
  }

  .rail-title {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 var(--spacing-xs);
  }

  .rail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  /* Only earned once two or more rows have exhausted their automatic retries. */
  .retry-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    cursor: pointer;
  }

  .retry-all:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
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

  .row-item.missing {
    border-color: color-mix(in srgb, var(--theme-danger, #ef4444) 45%, transparent);
  }

  /* TKA Letters webfont — the glyphs need more size than body copy to read. */
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
    font-size: 1.05rem;
    line-height: 1.3;
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

  /* Reserved status slot. Fixed width, ALWAYS mounted: loading, retrying,
     error, and ready all occupy the same box, so a row recovering (or failing)
     never shifts its neighbours (no-layout-shift). */
  .row-status {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    visibility: hidden;
  }

  .row-status.show {
    visibility: visible;
  }

  .row-status .icon-btn {
    width: 24px;
    height: 24px;
  }

  .row-missing {
    color: var(--theme-danger, #ef4444);
    font-size: var(--font-size-sm, 0.875rem);
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

  /* A confirmed-missing row has nothing to retry — removing it is the action,
     so its remove button carries the tint full-time. */
  .icon-btn-danger.emphasised {
    color: var(--theme-danger, #ef4444);
  }

  /* Retry after the automatic attempts are spent: danger-tinted so the row
     reads as needing a hand. */
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

  /* Cue-rail / note-strip toggles sit as a wrapping chip row under their label. */
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .bpm-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .bpm-input {
    width: 5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .bpm-input:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  .btn-prefill {
    flex: 1;
    justify-content: center;
    min-width: 0;
    padding: 0 var(--spacing-sm);
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
    /* Same scrim treatment as the rail: cards cover this when populated, but
       the empty-state copy and loading status sit directly on the background. */
    background: color-mix(in srgb, var(--theme-panel-bg, #14141c) 45%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: var(--spacing-sm);
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
    .browse-dock > :global(*) {
      width: auto;
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
