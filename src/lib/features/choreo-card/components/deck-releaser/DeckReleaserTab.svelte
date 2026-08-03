<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { Catalog } from "../../domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { loadCatalogs, loadSequencesByIds } from "../../services/catalog-loader";
  import {
    buildSequencePool,
    getAvailableWeights,
    getCatalogSourceSummaries,
    getTnDFamilyOptions,
    getTnDTurnPatternOptions,
    buildTnDCards,
    buildTnDSeedClasses,
    composeDeck,
    loopDrawCounts,
    swapCard,
    prunePool,
    TND_BASE_CATALOG_ID,
    type CatalogPoolFilter,
    type PoolEntry,
  } from "../../services/deck-composer";
  import type { DeckRelease, DeckReleaseCard, DeckRecipe } from "../../domain/models/DeckRelease";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getNextDeckNumber, releaseDeck, getAllReleases, updateDeckMeta, deleteDeck } from "../../services/deck-release-store";
  import ConfigureStep from "./ConfigureStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";
  import ReleaseHistoryPanel from "./ReleaseHistoryPanel.svelte";
  import GeneratedArchivePanel from "./GeneratedArchivePanel.svelte";
  import { archiveDeck, listArchivedDecks, getArchivedDeck, deleteArchivedDeck, type ArchivedDeckMeta } from "../../services/deck-archive-store";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import PrintPanel from "../print-preview/PrintPanel.svelte";
  import DeckReleaseNameModal from "./DeckReleaseNameModal.svelte";
  import { releaserState as rs } from "./deck-releaser-state.svelte";
  import { resolveDeckSequences, applyVariationDescriptor, rollVariation } from "../../services/deck-variation";
  import { makeRng, childSeed } from "$lib/shared/foundation/utils/seeded-rng";
  import { hashRecipe, mintSeed } from "../../services/deck-recipe";
  import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
  import { GenerationMode } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { GenerationOptions } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { levelToDifficulty } from "$lib/shared/create/utils/config-mapper";
  import { resolveLoopConfig } from "$lib/shared/create/services/loop-type-utils";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { loadDiamondEdges } from "../../services/pictograph-letter-lookup";
  import { prewarmCardPool } from "$lib/shared/render/services/card-pool-prewarm";
  import { warmCardBackCaches } from "../../services/card-back/warm-card-back-caches";
  import { hashDeckContent, hashSequenceContent, hashSequenceSkeleton } from "$lib/shared/foundation/services/content-hasher";
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import type { CardPair } from "../../services/types";
  import { getTnDElementByIconPath, TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";
  import { suggestCopyCounts, copyWaste } from "../../services/print-copy-suggester";
  import { buildDeckAiSummary } from "../../services/deck-ai-summary";
  import type { CardPair } from "../../services/types";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";
  import type { PrintSide } from "../print-preview/PrintPanel.svelte";

  interface Props {
    onContextMenu?: (
      x: number,
      y: number,
      rerender: () => void,
      sequence?: import("$lib/shared/foundation/domain/models/sequence-data").SequenceData,
    ) => void;
  }

  let { onContextMenu }: Props = $props();

  // Captured synchronously at component init, BEFORE any $effect runs. The
  // auto-persist effect below would otherwise fire first and overwrite the saved
  // viewingDeckNumber with null (viewingRelease isn't restored until onMount),
  // wiping the very value the restore needs to reopen a released deck.
  const initialViewingDeckNumber = rs.savedViewingDeckNumber;
  // Persist is gated until the mount-time restore finishes, so the effect can
  // never clobber the saved session before restore reads it.
  let persistReady = $state(false);

  let catalogs = $state<Catalog[]>([]);
  let pool = $state<Map<number, PoolEntry[]>>(new Map());
  let releasedIds = $state<Set<string>>(new Set());
  let releases = $state<DeckRelease[]>([]);
  // All current releases are Timing & Direction decks; loop releasing is the new
  // path and always stamps recipe.deckMode "loop". So "not explicitly loop"
  // (incl. legacy releases with no recipe) groups under the TnD subsection;
  // future loop releases fall to the general "Released Decks" section.
  // Three Released subsections, classified by recipe.deckMode. Gallery is explicit;
  // legacy releases (no recipe) read as TnD (all pre-recipe releases were TnD).
  const isGalleryRelease = (r: DeckRelease) => r.recipe?.deckMode === "gallery";
  const isLoopRelease = (r: DeckRelease) => r.recipe?.deckMode === "loop";
  const isTnDRelease = (r: DeckRelease) => !isGalleryRelease(r) && !isLoopRelease(r);
  const tndReleases = $derived(releases.filter(isTnDRelease));
  const galleryReleases = $derived(releases.filter(isGalleryRelease));
  const loopReleases = $derived(releases.filter(isLoopRelease));
  // Decks that follow the live prop setting (no pinned canonical prop): TnD +
  // Gallery, composed or released. Drives the in-deck prop switcher + prop unpin.
  const deckFollowsLiveProp = $derived(
    rs.viewingRelease ? !isLoopRelease(rs.viewingRelease) : rs.deckMode !== "loop",
  );
  // Gallery deck currently on screen (drives the Refresh-from-gallery action).
  const viewingGallery = $derived(
    rs.viewingRelease ? isGalleryRelease(rs.viewingRelease) : rs.deckMode === "gallery",
  );
  let archivedDecks = $state<ArchivedDeckMeta[]>([]);
  let isLoadingArchive = $state(true);
  let isLoadingReleases = $state(true);
  let showNameModal = $state(false);

  // Content fingerprint → release. A freshly composed deck whose card set exactly
  // matches a release (any order) bounces the user into that release instead of
  // re-creating a twin. Rebuilds automatically as releases load / one is added.
  const releaseHashes = $derived.by(() => {
    const map = new Map<string, DeckRelease>();
    for (const r of releases) map.set(hashDeckContent(r.sequences ?? []), r);
    return map;
  });

  /** If the composed deck matches an existing release, bounce into it and return
   *  true; the caller skips the fresh-review path. */
  async function bounceIfDuplicate(): Promise<boolean> {
    const match = releaseHashes.get(hashDeckContent(rs.cards));
    if (!match) return false;
    toast.info(`This deck already exists as Deck #${String(match.deckNumber).padStart(3, "0")}`);
    await handleSelectRelease(match);
    return true;
  }

  const ICON_UPGRADES: Record<string, string> = {
    "/images/elements/sun-v2.png": "/images/elements/sun-v4.png",
  };
  const footers = $derived(rs.cards.map(c => {
    const f = c.footer;
    if (f.iconPath && ICON_UPGRADES[f.iconPath]) {
      return { ...f, iconPath: ICON_UPGRADES[f.iconPath] };
    }
    return f;
  }));

  // ── Print state (lifted from ReviewStep so the sidebar PrintPanel and the
  //    preview pane share one owner) ──────────────────────────────────────────
  const PRINT_SETTINGS_KEY = "deckReleaser.printSettings";
  interface PersistedPrintSettings { cardSize: CardSizeId; copies: number; groupByElement: boolean; groupByLetter?: boolean; }
  function loadPrintSettings(): Partial<PersistedPrintSettings> {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(PRINT_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  const savedPrint = loadPrintSettings();

  let cardSize = $state<CardSizeId>(savedPrint.cardSize ?? "poker");
  // Default to one card per page (9 poker / 6 tarot) — a full sheet of one card,
  // cut into identical copies. The most-used layout; returning users keep theirs.
  let copies = $state(savedPrint.copies ?? getPageLayout(cardSize).cardsPerPage);
  let groupByElement = $state(savedPrint.groupByElement ?? true);
  let groupByLetter = $state(savedPrint.groupByLetter ?? false);
  let selectedSide = $state<PrintSide>("fronts");

  $effect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PRINT_SETTINGS_KEY,
        JSON.stringify({ cardSize, copies, groupByElement, groupByLetter } satisfies PersistedPrintSettings));
    } catch { /* quota / private mode — non-fatal */ }
  });

  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let isExporting = $state(false);
  let isPrinting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportError = $state("");
  let rerenderKey = $state(0);

  // Element-sort: order cards by TnD element so the preview + PDF group cleanly.
  // Reads `footers` (computed above) + rs.sequences — both tab-level.
  const elementSorted = $derived.by(() => {
    const rawElements = (footers ?? []).map((f) => getTnDElementByIconPath(f.iconPath ?? "") ?? undefined);
    const elementOrder = TND_ELEMENTS.map((e) => e.element);
    const indexed = rs.sequences.map((seq, i) => ({ seq, footer: footers?.[i], el: rawElements[i], origIndex: i }));

    // First-appearance rank per letter (word), in original composition order, so
    // clustering yields AAABBBCCC. When color grouping is also on, color is the
    // primary key and letters cluster within each color block. The two toggles
    // are independent axes — neither, either, or both can be active.
    const letterRank = new Map<string, number>();
    if (groupByLetter) {
      for (const r of indexed) {
        const w = r.seq.word ?? "";
        if (!letterRank.has(w)) letterRank.set(w, letterRank.size);
      }
    }
    const elIndex = (el?: TnDElement) => (el ? elementOrder.indexOf(el.element) : 999);

    indexed.sort((a, b) => {
      if (groupByElement) {
        const d = elIndex(a.el) - elIndex(b.el);
        if (d !== 0) return d;
      }
      if (groupByLetter) {
        const d = (letterRank.get(a.seq.word ?? "") ?? 0) - (letterRank.get(b.seq.word ?? "") ?? 0);
        if (d !== 0) return d;
      }
      return a.origIndex - b.origIndex;
    });
    return {
      sequences: indexed.map((r) => r.seq),
      footers: indexed.map((r) => r.footer!).filter(Boolean),
      tndElements: indexed.map((r) => r.el),
    };
  });
  const sortedSequences = $derived(elementSorted.sequences);
  const sortedFooters = $derived(elementSorted.footers);
  const tndElements = $derived(elementSorted.tndElements);
  // Render denominator = live deck size, not a value echoed back from the
  // renderer — a stale render run (deck size changed mid-render) can't leave the
  // old count lingering. Declared after sortedSequences (its dependency).
  const renderTotal = $derived(sortedSequences.length);
  // Deck reference number for filenames / cache key / on-card label / PDF meta.
  // Viewing a released deck → its permanent number; otherwise the per-generation
  // internal reference number (NOT the Firestore release counter).
  const deckRefNumber = $derived(rs.viewingRelease?.deckNumber ?? rs.referenceNumber);
  const deckRefPadded = $derived(String(deckRefNumber).padStart(3, "0"));

  const groupSizes = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const el of tndElements) {
      const key = el?.element ?? "__untagged__";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  const cardsPerPage = $derived(getPageLayout(cardSize).cardsPerPage);
  const copiesPresets = $derived.by(() => {
    const ladder = suggestCopyCounts(groupSizes, cardsPerPage).map((s) => s.copies);
    // copies === cardsPerPage fills exactly one sheet per card (one card repeated
    // a full sheet, cut into N identical copies) — always zero-waste, max cut
    // consistency. Always offer it (9 for poker, 6 for tarot) even when the waste
    // ladder wouldn't surface it on its own.
    const withSheet = ladder.includes(cardsPerPage) ? ladder : [...ladder, cardsPerPage];
    return withSheet.sort((a, b) => a - b);
  });
  function copiesAnnotate(n: number) {
    const w = copyWaste(groupSizes, cardsPerPage, n);
    return { blanks: w.blanks, perfect: w.blanks === 0 };
  }

  // Bundle the deck — identity, current print layout, frozen recipe, full card
  // list — as markdown for the Copy-for-AI button. Recipe comes from the viewed
  // release when open, else the live dial-set.
  function getAiSummary(): string {
    const w = copyWaste(groupSizes, cardsPerPage, copies);
    return buildDeckAiSummary({
      name: rs.name,
      deckNumber: rs.viewingRelease?.deckNumber ?? rs.nextDeckNumber,
      isReleased: rs.viewingRelease != null,
      cards: rs.cards,
      layout: {
        cardSize,
        cardsPerPage,
        copies,
        groupByColor: groupByElement,
        groupByLetter,
        sheets: w.sheets,
        blanks: w.blanks,
      },
      recipe: rs.viewingRelease?.recipe ?? rs.toRecipe(),
    });
  }

  // Order-sensitive content + visual fingerprint of exactly what the print PDF
  // will draw. The built-PDF cache keys on this (plus mode/copies/grouping/size),
  // so an unchanged deck re-prints the same blob instantly instead of rebuilding.
  // Covers: ordered card content (sorted = the print order), per-card element
  // accent, the back theme, and prop types — every input that changes a pixel.
  // copies/groupByElement affect slot planning, not order, so they're appended
  // per-call in buildPrintKey, not here.
  const printDeckSig = $derived.by(() => {
    const cards = sortedSequences
      .map((s, i) => `${hashSequenceContent(s)}:${tndElements[i]?.element ?? "_"}`)
      .join(",");
    return ["v1", rs.theme, rs.bluePropType, rs.redPropType, cardSize, cards].join("|");
  });

  function buildPrintKey(mode: PrintPDFMode): string {
    const deckName = `Deck_${deckRefPadded}`;
    return [deckName, mode, copies, groupByElement, printDeckSig].join("§");
  }

  /** Deck contents → PDF document metadata, so a downloaded file is indexable
   *  by its reference number and its word list without opening it. */
  function buildDeckMeta() {
    const loop = [...rs.selectedLoopTypes][0] ?? "rotated";
    const level = [...rs.selectedLevels][0] ?? 1;
    const period = [...rs.selectedSliceTypes][0] ?? "";
    const words = [
      ...new Set(sortedSequences.map((s) => simplifyRepeatedWord(s.word ?? "")).filter(Boolean)),
    ];
    const count = sortedSequences.length;
    const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
    const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    const turns = `${rs.turnIntensity} turn${rs.turnIntensity === 1 ? "" : "s"}`;
    const gridMode = [...rs.selectedGridModes][0] ?? "diamond";
    const prop = pretty(String(rs.bluePropType));
    // The specific deck this card belongs to (released name, else its number),
    // so a printed sheet names its deck alongside the recipe it was built from.
    const deckLabel = rs.name?.trim() || `Deck #${deckRefPadded}`;
    // Concise recipe printed centered in each sheet's top margin: the deck it
    // belongs to, then the compose recipe (loop, period, length, level, turns,
    // grid, prop).
    const deckSummary = [
      deckLabel,
      cap(loop),
      period ? cap(period) : null,
      `${rs.selectedLength}-step`,
      `L${level}`,
      turns,
      cap(gridMode),
      prop,
    ].filter(Boolean).join("  ·  ");
    return {
      title: `Deck ${deckRefPadded}: ${count} cards`,
      subject:
        `LOOP ${loop} · ${rs.selectedLength}-step · L${level}` +
        `${period ? ` · ${period}` : ""} · ${cap(gridMode)} · ${prop} · ${count} cards.` +
        ` Words: ${words.join(", ")}`,
      keywords: words,
      deckSummary,
    };
  }

  // Recipe line shown both centered on each exported PDF sheet AND in the print
  // preview's top margin, so screen matches print. Same source as the PDF meta.
  const deckSummaryLine = $derived(buildDeckMeta().deckSummary);

  // ── Generated-deck archive (local IndexedDB) ───────────────────────────────
  async function refreshArchive() {
    archivedDecks = await listArchivedDecks();
    isLoadingArchive = false;
  }

  function buildArchiveMeta(): ArchivedDeckMeta {
    return {
      refNumber: rs.referenceNumber,
      createdAt: new Date().toISOString(),
      deckMode: rs.deckMode,
      loopType: [...rs.selectedLoopTypes][0],
      length: rs.selectedLength,
      level: [...rs.selectedLevels][0],
      period: [...rs.selectedSliceTypes][0],
      prop: String(rs.bluePropType),
      cardCount: rs.cards.length,
      words: buildDeckMeta().keywords,
    };
  }

  /** Persist the just-generated deck to the local archive (every generation, no
   *  cap). Best-effort + fire-and-forget — never blocks the draw. Skips released
   *  views and empty/unnumbered decks. */
  function archiveCurrentDeck() {
    if (rs.viewingRelease || rs.cards.length === 0 || rs.referenceNumber <= 0) return;
    const meta = buildArchiveMeta();
    const payload = {
      refNumber: rs.referenceNumber,
      // Snapshot out of the rune proxies so IndexedDB structured-clone is clean.
      cards: $state.snapshot(rs.cards) as DeckReleaseCard[],
      sequences: $state.snapshot(rs.sequences) as SequenceData[],
    };
    void archiveDeck(meta, payload).then(refreshArchive);
  }

  /** Re-open an archived deck: load its exact cards/sequences back into Review so
   *  its backs can be recovered (re-rendered, printed, exported, released). */
  async function openArchivedDeck(refNumber: number) {
    const payload = await getArchivedDeck(refNumber);
    if (!payload) { toast.info("Couldn't load that archived deck."); return; }
    ++rs.drawGeneration; // cancel any in-flight draw
    const meta = archivedDecks.find((d) => d.refNumber === refNumber);
    rs.viewingRelease = null;
    rs.name = ""; // generated decks are titled by number, not a stale release name
    rs.referenceNumber = refNumber;
    rs.sequences = payload.sequences;
    rs.cards = payload.cards;
    if (meta) {
      rs.deckMode = meta.deckMode;
      if (meta.loopType) rs.selectedLoopTypes = new Set([meta.loopType]);
      if (meta.length) rs.selectedLength = meta.length;
      if (meta.level) rs.selectedLevels = new Set([meta.level]);
      if (meta.period) rs.selectedSliceTypes = new Set([meta.period as "halved" | "quartered"]);
      if (meta.prop) rs.selectedPropType = meta.prop as PropType;
    }
    rs.step = "review";
    rs.persist();
  }

  async function handleDeleteArchived(refNumber: number) {
    await deleteArchivedDeck(refNumber);
    await refreshArchive();
  }

  // 'fronts'/'backs' scope the preview to that side; combined/zip show all.
  const previewSideFilter = $derived(
    selectedSide === "fronts" ? "fronts" : selectedSide === "backs" ? "backs" : null,
  );

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function physicalDeckIdentity() {
    const releaseNumber = rs.viewingRelease?.deckNumber ?? null;
    return {
      deckId: releaseNumber
        ? `release:${releaseNumber}`
        : `generated:${deckRefNumber}`,
      deckName: rs.name?.trim() || `Deck #${deckRefPadded}`,
      deckReleaseNumber: releaseNumber,
    };
  }

  function metaForPrintRun(printRunId: string) {
    const meta = buildDeckMeta();
    return {
      ...meta,
      subject: `${meta.subject} Serialized artwork run ${printRunId}.`,
      keywords: [...(meta.keywords ?? []), `print-run:${printRunId}`],
    };
  }

  async function recordFailedPrintRun(run: {
    printRunId: string;
    fail(): Promise<void>;
  }): Promise<void> {
    try {
      await run.fail();
    } catch (error) {
      console.error(
        `[deck-releaser] could not mark print run ${run.printRunId} failed:`,
        error,
      );
    }
  }

  /** The "How to Read" insert that ships as card 1 of every printed deck.
   *  Carries this deck's number, so it is rendered against the live deck ref. */
  async function buildInsertPair(): Promise<CardPair> {
    const { renderInsertCardPair } = await import(
      "$lib/features/choreo-card/services/PrintCardRenderer"
    );
    const { front, back } = await renderInsertCardPair({
      theme: rs.theme,
      cardSize,
      deckNumber: deckRefNumber,
    });
    return { front, back, label: "How to Read" };
  }

  async function buildPrintPDF(mode: PrintPDFMode): Promise<{
    blob: Blob;
    printRunId: string | null;
  }> {
    const deckName = `Deck_${deckRefPadded}`;
    const onProgress = (current: number, total: number) => {
      exportProgress = current;
      exportTotal = total;
    };

    // A backs-only file contains no identity-bearing QR. Reuse the existing
    // byte cache and do not claim another physical issuance.
    if (mode === "backs") {
      const { getOrBuildPrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-cache");
      const blob = await getOrBuildPrintPDF(
        buildPrintKey(mode),
        renderedPairs,
        deckName,
        cardSize,
        mode,
        {
          copies,
          elements: tndElements,
          groupByElement,
          meta: buildDeckMeta(),
          insertPair: await buildInsertPair(),
        },
        onProgress,
      );
      return { blob, printRunId: null };
    }

    // Every explicit front/combined export is a new issuance run. The PDF cache
    // is intentionally bypassed because reusing it would silently reuse every
    // physical-card identity.
    const [{ prepareSerializedPrintRun }, { exportHomePrintPDF }] = await Promise.all([
      import("$lib/features/choreo-card/services/serialized-print-run"),
      import("$lib/features/choreo-card/services/print-pdf-exporter"),
    ]);
    const identity = physicalDeckIdentity();
    const run = await prepareSerializedPrintRun({
      pairs: renderedPairs,
      ...identity,
      cardSize,
      copies,
      groupByElement,
      outputMode: mode,
    });
    let blob: Blob;
    try {
      blob = await exportHomePrintPDF(
        renderedPairs,
        deckName,
        cardSize,
        onProgress,
        mode,
        {
          copies,
          elements: tndElements,
          groupByElement,
          meta: metaForPrintRun(run.printRunId),
          insertPair: await buildInsertPair(),
          frontRenderer: ({ pair, cardIndex, copyIndex }) =>
            run.renderFront(pair, cardIndex, copyIndex),
        },
      );
    } catch (error) {
      await recordFailedPrintRun(run);
      throw error;
    }
    await run.complete();
    return { blob, printRunId: run.printRunId };
  }

  async function handleExportPDF(mode: PrintPDFMode = "combined") {
    if (renderedPairs.length === 0) return;
    isExporting = true; exportError = ""; exportProgress = 0; exportTotal = 0;
    try {
      const deckName = `Deck_${deckRefPadded}`;
      const copiesSuffix = copies > 1 ? `_x${copies}` : "";
      const suffix = (mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print") + copiesSuffix;
      const { blob, printRunId } = await buildPrintPDF(mode);
      const runSuffix = printRunId ? `_run-${printRunId.slice(0, 8)}` : "";
      triggerDownload(blob, `${deckName}${suffix}${runSuffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false; exportProgress = 0; exportTotal = 0;
    }
  }

  /** Download fronts + backs as TWO separate PDF files in one click (no combined
   *  page, no per-side clicking). Sequential so each finishes before the next. */
  async function handleExportFrontsAndBacks() {
    if (renderedPairs.length === 0 || isExporting) return;
    await handleExportPDF("fronts");
    await handleExportPDF("backs");
  }

  async function handlePrint(mode: PrintPDFMode) {
    if (renderedPairs.length === 0 || isPrinting) return;
    isPrinting = true; exportError = "";
    try {
      const { printPdfBlob } = await import("$lib/features/choreo-card/services/print-blob");
      const { blob } = await buildPrintPDF(mode);
      printPdfBlob(blob);
    } catch (e) {
      exportError = `Print failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isPrinting = false;
    }
  }

  async function handleExportZIP() {
    if (renderedPairs.length === 0) return;
    isExporting = true; exportError = ""; exportProgress = 0; exportTotal = 0;
    try {
      const [{ exportDeckZIP }, { prepareSerializedPrintRun }] = await Promise.all([
        import("$lib/features/choreo-card/services/print-zip-exporter"),
        import("$lib/features/choreo-card/services/serialized-print-run"),
      ]);
      const deckName = `Deck_${deckRefPadded}`;
      const run = await prepareSerializedPrintRun({
        pairs: renderedPairs,
        ...physicalDeckIdentity(),
        cardSize,
        copies: 1,
        groupByElement,
        outputMode: "zip",
      });
      let blob: Blob;
      try {
        blob = await exportDeckZIP(renderedPairs, deckName, (current, total) => {
          exportProgress = current; exportTotal = total;
        }, {
          insertPair: await buildInsertPair(),
          frontRenderer: (pair, cardIndex) =>
            run.renderFront(pair, cardIndex, 0),
        });
      } catch (error) {
        await recordFailedPrintRun(run);
        throw error;
      }
      await run.complete();
      triggerDownload(
        blob,
        `${deckName}_cards_run-${run.printRunId.slice(0, 8)}.zip`,
      );
    } catch (e) {
      exportError = `ZIP export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false; exportProgress = 0; exportTotal = 0;
    }
  }

  function rebuildPool() {
    const filter: CatalogPoolFilter = {
      sliceTypes: rs.selectedSliceTypes,
      loopTypes: rs.selectedLoopTypes,
      levels: rs.selectedLevels,
      startPositionIds: rs.selectedStartPositionIds.size > 0 ? rs.selectedStartPositionIds : undefined,
    };
    pool = buildSequencePool(catalogs, filter);
    if (releasedIds.size > 0) {
      prunePool(pool, releasedIds, new Set([4]));
    }
    // Re-derive `available` counts from the fresh pool, but carry over the user's
    // weight values (restored from a prior session or set this session) so a
    // rebuild never silently resets the dials.
    const fresh = getAvailableWeights(pool);
    const prevWeights = new Map(rs.weights.map((w) => [w.stepCount, w.weight]));
    rs.weights = fresh.map((w) =>
      prevWeights.has(w.stepCount) ? { ...w, weight: prevWeights.get(w.stepCount)! } : w,
    );
  }

  // Auto-persist every configure-step modification. Because persist() runs inside
  // the effect, it reactively tracks every field it serializes (dials, weights,
  // selections, draft) — so any change to the catalog config is saved without
  // each handler having to remember to call persist().
  $effect(() => {
    if (!persistReady) return;
    rs.persist();
  });

  function extractReleasedIds(rels: DeckRelease[]): Set<string> {
    const ids = new Set<string>();
    for (const r of rels) {
      for (const card of r.sequences ?? []) ids.add(card.sequenceId);
    }
    return ids;
  }

  type SidebarMode = "browse" | "print";
  // Persist the Browse/Print sidebar tab across refresh / re-open, same lifetime
  // as the print dials. localStorage, not session.
  const SIDEBAR_MODE_KEY = "deckReleaser.sidebarMode";
  function loadSidebarMode(): SidebarMode {
    if (typeof window === "undefined") return "browse";
    try {
      const raw = localStorage.getItem(SIDEBAR_MODE_KEY);
      return raw === "print" || raw === "browse" ? raw : "browse";
    } catch { return "browse"; }
  }
  let sidebarMode = $state<SidebarMode>(loadSidebarMode());

  $effect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode); } catch { /* quota / private mode — non-fatal */ }
  });

  async function handleDeleteRelease(deckNumber: number) {
    try {
      await deleteDeck(deckNumber);
      releases = releases.filter((r) => r.deckNumber !== deckNumber);
      releasedIds = extractReleasedIds(releases);
      if (rs.viewingRelease?.deckNumber === deckNumber) {
        rs.viewingRelease = null;
        rs.themeOverride = null;
        rs.bluePropOverride = null;
        rs.redPropOverride = null;
        rs.step = "configure";
        rs.persist();
      }
      toast.success(`Deck #${String(deckNumber).padStart(3, "0")} deleted`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      const isPermission = msg.includes("permission") || msg.includes("PERMISSION_DENIED");
      toast.error(isPermission ? "Admin access required to delete decks." : `Delete failed: ${msg}`);
    }
  }

  onMount(async () => {
    const savedDeckNumber = initialViewingDeckNumber;
    void refreshArchive();

    const releasesPromise = getAllReleases().then(r => {
      releases = r;
      releasedIds = extractReleasedIds(r);
      isLoadingReleases = false;
    }).catch(() => { isLoadingReleases = false; });

    if (rs.poolsLoaded) {
      rs.isLoadingPools = false;
      await releasesPromise;
      restoreViewedRelease(savedDeckNumber);
      await restoreDraftDeck(savedDeckNumber);
      persistReady = true;
      return;
    }

    try {
      catalogs = await loadCatalogs();
      rs.sourceSummaries = getCatalogSourceSummaries(catalogs);
      // Classify each base TnD seed for both grids once (selection-independent).
      // Element is NOT rotation-invariant, so the family is derived from the
      // box-transformed geometry — never carried over from the diamond catalog.
      const baseCatalog = catalogs.find((c) => c.id === TND_BASE_CATALOG_ID);
      const baseSeedIds = baseCatalog
        ? baseCatalog.families.flatMap((f) => f.sequenceIds)
        : [];
      if (baseSeedIds.length > 0) {
        const baseSeqs = await loadSequencesByIds(TND_BASE_CATALOG_ID, baseSeedIds);
        rs.tndSeedClasses = buildTnDSeedClasses(baseSeqs);
      }
      await releasesPromise;
      rebuildPool();
    } catch (err) {
      console.warn("Failed to load deck pools:", err);
    } finally {
      rs.isLoadingPools = false;
      rs.poolsLoaded = true;
    }

    try {
      rs.nextDeckNumber = await getNextDeckNumber();
    } catch {
      rs.nextDeckNumber = 1;
    }

    restoreViewedRelease(savedDeckNumber);
    await restoreDraftDeck(savedDeckNumber);
    persistReady = true;
  });

  function restoreViewedRelease(deckNumber: number | null) {
    if (!deckNumber || rs.viewingRelease) return;
    const match = releases.find(r => r.deckNumber === deckNumber);
    if (match) handleSelectRelease(match);
  }

  // The state singleton restored rs.cards from localStorage, but sequences (heavy
  // SequenceData) are never stored — re-derive them here so the deck renders after
  // an HMR re-eval / refresh / tab reopen. No-op when viewing a release or when a
  // draw already populated sequences this session.
  async function restoreDraftDeck(savedDeckNumber: number | null) {
    if (savedDeckNumber || rs.viewingRelease) return;
    if (rs.step !== "review" || rs.cards.length === 0) return;
    if (rs.sequences.length === rs.cards.length) return;

    // Live-generated decks can't be re-derived from a catalog — their cards
    // carry sourceCatalogId "live-gen" with synthetic ids, so loadSequencesByIds
    // returns nothing. Restore their exact sequences/cards from the IndexedDB
    // archive instead, keyed by the persisted reference number.
    const isLiveGen = rs.cards.some((c) => c.sourceCatalogId === "live-gen");
    if (isLiveGen) {
      if (rs.referenceNumber > 0) {
        const payload = await getArchivedDeck(rs.referenceNumber);
        if (payload?.sequences.length) {
          rs.sequences = payload.sequences;
          rs.cards = payload.cards;
          prewarmCardPool({
            sequences: rs.sequences,
            bluePropType: rs.bluePropType,
            redPropType: rs.redPropType,
            theme: rs.theme,
            iconPaths: rs.cards.map((c) => c.footer?.iconPath).filter((p): p is string => !!p),
          });
          const warmSeq = rs.sequences[0];
          if (warmSeq) warmCardBackCaches(warmSeq, rs.theme);
          return;
        }
      }
      // No archived payload to recover from — can't rebuild a live-gen deck.
      toast.info("This generated deck's cards couldn't be restored. Redraw to rebuild it.");
      return;
    }

    const gen = ++rs.drawGeneration;
    await loadSelectedSequences(gen);
  }

  function handleSliceTypeToggle(sliceType: 'halved' | 'quartered') {
    const next = new Set(rs.selectedSliceTypes);
    if (next.has(sliceType)) {
      if (next.size > 1) next.delete(sliceType);
    } else {
      next.add(sliceType);
    }
    rs.selectedSliceTypes = next;
    rebuildPool();
  }

  function handleModeChange(mode: 'loop' | 'tnd' | 'gallery') {
    rs.deckMode = mode;
    if (mode === 'tnd' && rs.selectedTnDFamilies.size === 0) {
      rs.selectedTnDFamilies = new Set(rs.tndFamilies.map(f => f.familyId));
    }
    if (mode === 'tnd' && rs.selectedTnDTurnPatterns.size === 0) {
      rs.selectedTnDTurnPatterns = new Set(rs.tndTurnPatterns.map(tp => tp.turnPattern));
    }
  }

  function handleTnDFamilyToggle(familyId: string) {
    const next = new Set(rs.selectedTnDFamilies);
    if (next.has(familyId)) {
      next.delete(familyId);
    } else {
      next.add(familyId);
    }
    rs.selectedTnDFamilies = next;
  }

  function handleSelectAllFamilies() {
    rs.selectedTnDFamilies = new Set(rs.tndFamilies.map((f) => f.familyId));
  }

  function handleClearFamilies() {
    rs.selectedTnDFamilies = new Set();
  }

  function handleTnDTurnPatternToggle(tp: string) {
    const next = new Set(rs.selectedTnDTurnPatterns);
    if (next.has(tp)) {
      next.delete(tp);
    } else {
      next.add(tp);
    }
    rs.selectedTnDTurnPatterns = next;
  }

  function handleSetTnDTurnPatterns(patterns: Set<string>) {
    rs.selectedTnDTurnPatterns = patterns;
  }

  // Family options are grid-aware: each base seed lands in its computed element
  // per selected grid. Recompute when the seed classes or grid selection change.
  $effect(() => {
    rs.tndFamilies = getTnDFamilyOptions(rs.tndSeedClasses, [...rs.selectedGridModes]);
  });

  const tndCardCount = $derived(
    buildTnDCards(
      rs.tndFamilies,
      rs.selectedTnDFamilies,
      rs.selectedTnDTurnPatterns,
      [...rs.selectedStartOriModes],
    ).length
  );

  const selectedFamilyBaseSeqs = $derived(
    rs.tndFamilies
      .filter((f) => rs.selectedTnDFamilies.has(f.familyId))
      .reduce((sum, f) => sum + f.sequenceCount, 0),
  );
  $effect(() => {
    rs.tndTurnPatterns = getTnDTurnPatternOptions(selectedFamilyBaseSeqs);
  });

  function handleWeightChange(stepCount: number, weight: number) {
    rs.weights = rs.weights.map((w) =>
      w.stepCount === stepCount ? { ...w, weight } : w
    );
  }

  function composeFullDeck() {
    const registers = [...rs.selectedStartOriModes];
    const grids = [...rs.selectedGridModes];
    if (rs.deckMode === 'tnd') {
      const tndCards = buildTnDCards(
        rs.tndFamilies,
        rs.selectedTnDFamilies,
        rs.selectedTnDTurnPatterns,
        registers,
      );
      // Deck-wide reversal (build-one-apply-all): stamp the strip's pattern onto
      // every card's variation. Skip when the pattern reverses nothing (all "-"),
      // so the no-reversal path stays free of needless re-derivation.
      const rev = rs.reversalPattern;
      const hasReversal = rev != null && /[PRB]/.test(rev.sequence);
      return tndCards.map((c, i) => {
        const card = { ...c, position: i + 1 };
        if (!hasReversal) return card;
        return {
          ...card,
          variation: {
            ...(card.variation ?? {}),
            reversalSequence: rev!.sequence,
            reversalPatternId: rev!.id,
          },
        };
      });
    }
    // Rebuild the pool so the draw always reflects the current loop-type / level /
    // start-position dials, not just whatever the last slice toggle left in `pool`.
    rebuildPool();
    // Seeded draw: the recipe (dials + seed) is the durable truth. Same (recipe,
    // seed) → byte-identical deck (reproduce); Reroll mints a new seed → fresh draw.
    const recipe = rs.toRecipe();
    const masterKey = `${recipe.seed}:${hashRecipe(recipe)}`;
    const rng = makeRng(masterKey);
    // Target deck size is the FINAL count. Registers × grid modes each duplicate
    // every base card, so compose `base = target / multiplier` and let the
    // enumeration below fan it back up to ~target (e.g. 52 target + radial &
    // nonradial → 26 base × 2 = 52 out, not 104).
    const { base } = loopDrawCounts(rs.totalCards, registers.length, grids.length);
    const cards = composeDeck(pool, rs.weights, base, { center: rs.notes }, rng);
    // Full enumeration: each composed card is emitted once per (register × grid
    // mode), sharing the same rolled reversal/turn so register/grid are pure axes.
    // Per-slot sub-stream: each base card's variation is a pure function of
    // (recipe, slot index), so adding/removing one card never reshuffles the rest.
    const out: DeckReleaseCard[] = [];
    let position = 1;
    let baseIndex = 0;
    for (const c of cards) {
      const rolled = rollVariation(c.stepCount, rs.variationConfig, makeRng(childSeed(masterKey, baseIndex++)));
      for (const mode of registers) {
        for (const grid of grids) {
          const variation = {
            ...(rolled ?? {}),
            ...(mode !== "radial" ? { startOriMode: mode } : {}),
            ...(grid !== "diamond" ? { gridMode: grid } : {}),
          };
          out.push(
            Object.keys(variation).length > 0
              ? { ...c, position: position++, variation }
              : { ...c, position: position++ },
          );
        }
      }
    }
    return out;
  }

  /**
   * LOOP deck = live generation. Runs the same engine the Generate panel uses,
   * once per card, with the bento dials mapped to GenerationOptions. No Firestore
   * pool — every card is generated fresh, deduped by content. The engine is
   * unseeded, so each call yields a distinct sequence (fresh 52 every draw).
   * Returns false if the draw was superseded or produced nothing.
   */
  async function generateLiveDeck(generation: number): Promise<boolean> {
    const length = rs.selectedLength || 8;
    const gridMode = ([...rs.selectedGridModes][0] ?? "diamond") as "diamond" | "box";
    const loopType = ([...rs.selectedLoopTypes][0] ?? "rotated") as LOOPType;
    // Canonical loop-config resolution — the SAME guards the interactive
    // Generate panel gets: quartered→halved coercion for non-rotation loop
    // types (a period-2 transform asked as quartered collapses back to half the
    // requested length) plus the compositional wire spec so the orchestrator
    // divides length by the TRUE expander multiplier. Without this the deck
    // shipped 8- and 32-step cards for a requested 16.
    const resolvedLoop = resolveLoopConfig(
      loopType,
      rs.selectedSliceTypes.has("quartered") ? "quartered" : "halved",
    );
    const turnIntensity = rs.turnIntensity; // generator max-intensity model (0–3 scalar)
    const motionTypeFilter = rs.dashStyle === "low" ? "no-dash" : rs.dashStyle === "high" ? "prefer-dash" : null;

    // Selected start positions (GridPosition strings). Empty ⇒ engine picks any.
    // Build the position pictographs for the active grid mode so each card can be
    // seeded from one of the chosen positions; orientation is passed explicitly
    // (blue/redStartOrientation) so the engine bakes it into every step 0.
    const startPosPics =
      rs.selectedStartPositionIds.size > 0
        ? startPositionManager
            .getAllStartPositionVariations(
              gridMode as GridMode,
              rs.startOriBlue as Orientation,
              rs.startOriRed as Orientation,
            )
            .filter((p) => rs.selectedStartPositionIds.has(String(p.startPosition)))
        : [];

    const options: GenerationOptions = {
      mode: GenerationMode.CIRCULAR,
      length,
      gridMode,
      propType: rs.bluePropType,
      difficulty: levelToDifficulty([...rs.selectedLevels][0] ?? 1),
      loopType,
      period: resolvedLoop.period as GenerationOptions["period"],
      loopSpecWire: resolvedLoop.loopSpecWire,
      loopRhythm: resolvedLoop.loopRhythm,
      constraintPreset: rs.propStyle,
      handPathMode: rs.handStyle,
      motionTypeFilter,
      turnIntensity,
      blueStartOrientation: rs.startOriBlue,
      redStartOrientation: rs.startOriRed,
    };

    const target = rs.totalCards || 52;
    // Variety pack: distinct word titles are the priority. Fill EVERY distinct
    // title first (one pass, no repeats); only once the title space is exhausted
    // does any title get a single 2nd (path-distinct) copy — "a couple
    // duplicates is fine", never more. So a deck is mostly-unique words, and is
    // honestly smaller than the requested size when the config's word space is
    // small (e.g. 8-step QUARTERED → a 2-step seed → only a few dozen words;
    // halved seeds or longer lengths open up far more).
    const MAX_PER_WORD = 2;
    const seqs: SequenceData[] = [];
    // Dedup on the location-arrangement SKELETON (word + per-step locations,
    // motion type, rotation direction — NOT turns/orientations/reversal flags).
    // So a card the engine produces as "same path, different turn pattern" is
    // rejected; a repeated word title is only allowed when the path itself
    // differs. (Content-only dedup let zero-turn vs one-turn copies of an
    // identical path both through — exactly what we don't want.)
    const seenSkeleton = new Set<string>();
    const wordCount = new Map<string, number>(); // simplified word → accepted copies
    rs.isLoadingSequences = true;
    rs.drawProgress = 0;
    let attempts = 0;
    let sinceAccept = 0;
    let maxPerWord = 1;
    const promoteAfter = Math.max(60, Math.round(target / 3));
    const maxAttempts = target * 12;
    try {
      while (seqs.length < target && attempts < maxAttempts) {
        attempts++;
        if (generation !== rs.drawGeneration) return false;
        // Seed this card from a randomly-chosen selected start position (even
        // coverage across the set; engine picks any when none selected).
        if (startPosPics.length) {
          options.startPosition = startPosPics[Math.floor(Math.random() * startPosPics.length)];
        }
        let s: SequenceData;
        try {
          // The engine owns orientation closure, minimal-loop reduction, and
          // exact-length retries. Every caller gets the same result.
          s = await generationOrchestrator.generateSequence(options);
        } catch (e) {
          console.warn("Live deck: a generation attempt failed", e);
          continue;
        }

        // The deck keeps its own final invariant gate because a bad card must
        // never enter a fixed-count print run.
        if (s.steps.length !== length) continue;

        const skeleton = hashSequenceSkeleton(s);
        if (!seenSkeleton.has(skeleton)) {
          const word = simplifyRepeatedWord(s.word ?? "") || skeleton;
          const count = wordCount.get(word) ?? 0;
          if (count < maxPerWord) {
            seenSkeleton.add(skeleton);
            wordCount.set(word, count + 1);
            seqs.push(s);
            rs.drawProgress = seqs.length;
            sinceAccept = 0;
            continue;
          }
        }
        // Rejected (duplicate content, or this title already at the tier cap).
        sinceAccept++;
        if (sinceAccept >= promoteAfter) {
          if (maxPerWord < MAX_PER_WORD) {
            maxPerWord++;          // open up a 2nd, then 3rd copy per title
            sinceAccept = 0;
          } else {
            break;                // every title at 3 copies, nothing new → done
          }
        }
      }
    } finally {
      rs.isLoadingSequences = false;
    }
    if (generation !== rs.drawGeneration) return false;
    if (seqs.length === 0) {
      toast.info("Couldn't generate sequences for these settings. Try a different loop type or length.");
      return false;
    }
    if (seqs.length < target) {
      // Expected when the distinct-word space is smaller than the requested size.
      // Prioritizing variety (≤2 copies per word) over hitting the number. The
      // lever for more cards is a bigger word space: halved period or a longer
      // length give longer seeds = many more distinct words.
      toast.info(`Generated ${seqs.length} of ${target}. Only ${wordCount.size} distinct words exist for these settings. For more variety try Halved period or a longer length.`);
    }

    rs.sequences = seqs;
    rs.cards = seqs.map((s, i) => ({
      sequenceId: `${(s.word ?? "loop").slice(0, 16)}-${i}`,
      sourceCatalogId: "live-gen",
      stepCount: s.steps?.length ?? length,
      word: s.word ?? "",
      position: i + 1,
      footer: { center: rs.notes },
    }));
    prewarmCardPool({
      sequences: rs.sequences,
      bluePropType: rs.bluePropType,
      redPropType: rs.redPropType,
      theme: rs.theme,
      iconPaths: [],
    });
    return true;
  }

  /** Draw a deck from the operator's library by filter-query. Sets cards +
   *  sequences directly (the query already returns full SequenceData), mirroring
   *  the LOOP live-draw path. Returns false on empty result / failure. */
  async function composeGalleryDeck(gen: number): Promise<boolean> {
    rs.isLoadingSequences = true;
    try {
      const { queryGalleryDeck } = await import("../../services/gallery-deck-source");
      const { cards, sequences } = await queryGalleryDeck(rs.galleryFilters, rs.totalCards, rs.notes);
      if (gen !== rs.drawGeneration) return false;
      if (sequences.length === 0) {
        toast.info("No library sequences match these filters.");
        return false;
      }
      rs.sequences = sequences;
      rs.cards = cards;
      prewarmCardPool({
        sequences,
        bluePropType: rs.bluePropType,
        redPropType: rs.redPropType,
        theme: rs.theme,
        iconPaths: [],
      });
      return true;
    } catch (e) {
      console.warn("Gallery draw failed:", e);
      toast.error("Gallery draw failed. Check you're signed in.");
      return false;
    } finally {
      rs.isLoadingSequences = false;
    }
  }

  async function handleDraw() {
    const gen = ++rs.drawGeneration;
    // Fresh draw = a new, not-yet-named deck. Clear any leftover name.
    rs.name = "";
    rs.seed = mintSeed();
    rs.bumpReference();
    if (rs.deckMode === "loop") {
      const ok = await generateLiveDeck(gen);
      if (!ok || gen !== rs.drawGeneration) return;
    } else if (rs.deckMode === "gallery") {
      const ok = await composeGalleryDeck(gen);
      if (!ok || gen !== rs.drawGeneration) return;
    } else {
      rs.cards = composeFullDeck();
      if (await bounceIfDuplicate()) return;
      await loadSelectedSequences(gen);
      if (gen !== rs.drawGeneration) return;
    }
    archiveCurrentDeck();
    rs.step = "review";
    rs.persist();
  }

  async function handleRedraw() {
    const gen = ++rs.drawGeneration;
    rs.name = ""; // fresh draw = not-yet-named; title falls back to the deck number
    rs.reroll();
    rs.bumpReference();
    if (rs.deckMode === "loop") {
      const ok = await generateLiveDeck(gen);
      if (!ok || gen !== rs.drawGeneration) return;
    } else {
      rs.cards = composeFullDeck();
      if (await bounceIfDuplicate()) return;
      await loadSelectedSequences(gen);
      if (gen !== rs.drawGeneration) return;
    }
    archiveCurrentDeck();
    rs.persist();
  }

  /** Re-run the gallery filter against the live library and replace the on-screen
   *  deck with the current matches. Works while composing (uses live filters) or
   *  viewing a released gallery deck (uses the release's stamped filters). */
  async function handleRefreshGallery() {
    const filters = rs.viewingRelease?.recipe?.galleryFilters ?? rs.galleryFilters;
    const cap = rs.viewingRelease?.recipe?.totalCards ?? rs.totalCards;
    const gen = ++rs.drawGeneration;
    rs.isLoadingSequences = true;
    try {
      const { queryGalleryDeck } = await import("../../services/gallery-deck-source");
      const { cards, sequences } = await queryGalleryDeck(filters, cap, rs.notes);
      if (gen !== rs.drawGeneration) return;
      if (sequences.length === 0) { toast.info("No library sequences match these filters."); return; }
      rs.sequences = sequences;
      rs.cards = cards;
      prewarmCardPool({ sequences, bluePropType: rs.bluePropType, redPropType: rs.redPropType, theme: rs.theme, iconPaths: [] });
      rs.persist();
      if (!rs.viewingRelease) archiveCurrentDeck();
      toast.success(`Refreshed. ${sequences.length} sequences from your gallery.`);
    } catch (e) {
      console.warn("Gallery refresh failed:", e);
      toast.error("Gallery refresh failed.");
    } finally {
      rs.isLoadingSequences = false;
    }
  }

  async function loadSelectedSequences(generation: number) {
    rs.isLoadingSequences = true;
    try {
      // Load each base sequence once (TnD packs many cards over few base ids).
      const byCatalog = new Map<string, string[]>();
      const seen = new Set<string>();
      for (const card of rs.cards) {
        const key = `${card.sourceCatalogId}::${card.sequenceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ids = byCatalog.get(card.sourceCatalogId) ?? [];
        ids.push(card.sequenceId);
        byCatalog.set(card.sourceCatalogId, ids);
      }

      const baseByKey = new Map<string, SequenceData>();
      for (const [catalogId, seqIds] of byCatalog) {
        // Gallery cards aren't in any catalog — resolve them from the library.
        let loaded: SequenceData[];
        if (catalogId === "gallery") {
          const { resolveGalleryCards } = await import("../../services/gallery-deck-source");
          loaded = await resolveGalleryCards(seqIds);
        } else {
          loaded = await loadSequencesByIds(catalogId, seqIds);
        }
        for (const s of loaded) baseByKey.set(`${catalogId}::${s.id}`, s);
      }
      if (generation !== rs.drawGeneration) return;

      const needsVariation = rs.cards.some((c) => c.variation);
      const edges = needsVariation ? await loadDiamondEdges() : [];
      if (generation !== rs.drawGeneration) return;

      const resolved = resolveDeckSequences(rs.cards, baseByKey, edges);
      rs.sequences = resolved.map((r) => r.sequence);
      rs.brokenLoopCount = resolved.filter((r) => !r.turnLoopClosed).length;

      // Pre-warm the worker pool now — both Draw and view-release funnel through
      // here, so the ~5s asset-bundle seed overlaps the step→review transition and
      // the review render hits the warm path. Fire-and-forget; failure is a no-op
      // (render falls back to the main thread).
      prewarmCardPool({
        sequences: rs.sequences,
        bluePropType: rs.bluePropType,
        redPropType: rs.redPropType,
        theme: rs.theme,
        iconPaths: rs.cards
          .map((c) => c.footer?.iconPath)
          .filter((p): p is string => !!p),
      });

      // Pre-warm the card-BACK constant rasterizer caches off the critical path.
      // buildBackJob's first call mounts+rasterizes the theme-constant elements
      // (~340ms); doing it here (beside the front pool seed) relocates that freeze
      // into the step→review transition so the first card render doesn't block.
      const warmSeq = rs.sequences[0];
      if (warmSeq) warmCardBackCaches(warmSeq, rs.theme);
    } catch (err) {
      console.warn("Failed to load sequences:", err);
    } finally {
      rs.isLoadingSequences = false;
    }
  }

  async function handleSwapCard(index: number) {
    const oldCard = rs.cards[index];
    if (oldCard) {
      const bucket = pool.get(oldCard.stepCount);
      if (bucket) {
        pool.set(oldCard.stepCount, bucket.filter(e => e.sequenceId !== oldCard.sequenceId));
      }
    }

    rs.cards = swapCard(rs.cards, index, pool);
    const newCard = rs.cards[index];
    if (!newCard) return;

    try {
      const loaded = await loadSequencesByIds(newCard.sourceCatalogId, [newCard.sequenceId]);
      if (loaded.length > 0) {
        const base = loaded[0]!;
        let resolvedSeq = base;
        if (newCard.variation) {
          const edges = await loadDiamondEdges();
          resolvedSeq = applyVariationDescriptor(base, newCard.variation, edges).sequence;
        }
        rs.sequences = rs.sequences.map((s, i) => (i === index ? resolvedSeq : s));
      }
    } catch (err) {
      console.warn("Failed to load swapped sequence:", err);
    }
    // Persist the post-swap deck so the manual edit survives reload/HMR too.
    rs.persist();
  }

  /** Remove a card from the current LOOP deck. Resolved by sequence identity so
   *  the correct card goes regardless of the active sort; positions re-number,
   *  and the archived copy is kept in sync. TnD decks don't allow this. */
  function handleRemoveCard(seq: SequenceData) {
    if (rs.deckMode !== "loop") return;
    let i = rs.sequences.indexOf(seq);
    if (i < 0) i = rs.sequences.findIndex((s) => s.id === seq.id);
    if (i < 0) return;
    rs.sequences = rs.sequences.filter((_, idx) => idx !== i);
    rs.cards = rs.cards
      .filter((_, idx) => idx !== i)
      .map((c, idx) => ({ ...c, position: idx + 1 }));
    rs.persist();
    archiveCurrentDeck(); // re-archive the trimmed deck under the same ref number
  }

  function openReleaseModal() {
    showNameModal = true;
  }

  async function handleConfirmRelease(name: string, description: string) {
    rs.isReleasing = true;
    try {
      const release = await releaseDeck(rs.cards, rs.theme, rs.notes, {
        name,
        description,
        bluePropType: rs.bluePropType,
        redPropType: rs.redPropType,
      }, rs.toRecipe());
      rs.name = name;
      rs.description = description;
      rs.releasedNumber = release.deckNumber;
      rs.nextDeckNumber = release.deckNumber + 1;
      releases = [release, ...releases];
      for (const card of release.sequences ?? []) releasedIds.add(card.sequenceId);
      showNameModal = false;
      rs.step = "released";
      rs.persist();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Release failed";
      const isPermission = msg.includes("permission") || msg.includes("PERMISSION_DENIED");
      toast.error(isPermission ? "Admin access required to release decks." : `Release failed: ${msg}`);
    } finally {
      rs.isReleasing = false;
    }
  }

  async function handleRenameDeck(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !rs.viewingRelease) return;
    const deckNumber = rs.viewingRelease.deckNumber;
    rs.name = trimmed;
    releases = releases.map(r => r.deckNumber === deckNumber ? { ...r, name: trimmed } : r);
    if (rs.viewingRelease) rs.viewingRelease = { ...rs.viewingRelease, name: trimmed };
    rs.persist();
    try {
      await updateDeckMeta(deckNumber, { name: trimmed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rename failed";
      toast.error(`Couldn't save deck name: ${msg}`);
    }
  }

  function handleStartNew() {
    rs.reset();
  }

  function handleReuseRecipe(recipe: DeckRecipe) {
    rs.loadRecipe(recipe);
    toast.success("Recipe loaded. Tweak or press Draw for a fresh deck.");
  }

  async function handleSelectRelease(release: DeckRelease) {
    rs.viewingRelease = release;
    rs.cards = release.sequences;
    rs.notes = release.notes;
    rs.name = release.name ?? release.notes ?? `Deck #${String(release.deckNumber).padStart(3, "0")}`;
    rs.description = release.description ?? "";
    rs.nextDeckNumber = release.deckNumber;
    // Pin render to the deck's release-time visuals so the content-hash cache
    // key matches what was stored (otherwise live setting changes force a
    // full re-render every view). Older decks have no prop snapshot → staff.
    rs.themeOverride = release.theme ?? null;
    // TnD + Gallery decks have no canonical prop — they follow the current prop
    // setting so the in-deck switcher can change it. LOOP releases stay pinned to
    // their release-time prop (their cached render matches the stored snapshot).
    if (!isLoopRelease(release)) {
      rs.bluePropOverride = null;
      rs.redPropOverride = null;
    } else {
      rs.bluePropOverride = (release.bluePropType as PropType | undefined) ?? null;
      rs.redPropOverride = (release.redPropType as PropType | undefined) ?? null;
    }
    rs.step = "review";
    rs.persist();

    const gen = ++rs.drawGeneration;
    await loadSelectedSequences(gen);
  }
</script>

<div class="deck-releaser">
  <div class="releaser-main">
    {#if rs.step === "configure"}
      <ConfigureStep
        deckMode={rs.deckMode}
        weights={rs.weights}
        totalCards={rs.totalCards}
        notes={rs.notes}
        sourceSummaries={rs.sourceSummaries}
        selectedSliceTypes={rs.selectedSliceTypes}
        tndFamilies={rs.tndFamilies}
        selectedTnDFamilies={rs.selectedTnDFamilies}
        tndTurnPatterns={rs.tndTurnPatterns}
        selectedTnDTurnPatterns={rs.selectedTnDTurnPatterns}
        {tndCardCount}
        selectedTurnPatternCount={rs.selectedTnDTurnPatterns.size}
        isLoading={rs.isLoadingPools}
        onModeChange={handleModeChange}
        onWeightChange={handleWeightChange}
        onTotalCardsChange={(t) => { rs.totalCards = t; }}
        onNotesChange={(n) => { rs.notes = n; }}
        onSliceTypeToggle={handleSliceTypeToggle}
        onTnDFamilyToggle={handleTnDFamilyToggle}
        onSelectAllFamilies={handleSelectAllFamilies}
        onClearFamilies={handleClearFamilies}
        onTnDTurnPatternToggle={handleTnDTurnPatternToggle}
        onTnDTurnPatternsSet={handleSetTnDTurnPatterns}
        onDraw={handleDraw}
        variationConfig={rs.variationConfig}
        onVariationConfigChange={(c) => { rs.variationConfig = c; }}
        startOriModes={rs.selectedStartOriModes}
        onToggleStartOriMode={(m) => rs.toggleStartOriMode(m)}
        gridModes={rs.selectedGridModes}
        onToggleGridMode={(m) => rs.toggleGridMode(m)}
        reversalPattern={rs.reversalPattern}
        onReversalChange={(p) => { rs.reversalPattern = p; rs.persist(); }}
        isGenerating={rs.isLoadingSequences}
        genProgress={rs.drawProgress}
      />
    {:else if rs.step === "review"}
      <ReviewStep
        cards={rs.cards}
        sequences={rs.sequences}
        theme={rs.theme}
        bluePropType={rs.bluePropType}
        redPropType={rs.redPropType}
        nextDeckNumber={rs.nextDeckNumber}
        refNumber={deckRefNumber}
        deckName={rs.name}
        deckSummary={deckSummaryLine}
        isReleasing={rs.isReleasing}
        readOnly={rs.viewingRelease !== null}
        brokenLoopCount={rs.brokenLoopCount}
        showRedraw={rs.deckMode === "loop"}
        showPropSwitcher={deckFollowsLiveProp}
        showRefresh={viewingGallery}
        {footers}
        {onContextMenu}
        {cardSize}
        {copies}
        {groupByElement}
        {groupByLetter}
        {getAiSummary}
        {sortedSequences}
        {sortedFooters}
        {tndElements}
        {copiesPresets}
        copiesAnnotate={copiesAnnotate}
        {isRendering}
        {renderProgress}
        {renderTotal}
        {rerenderKey}
        sideFilter={previewSideFilter}
        onCardSizeChange={(s) => {
          // Keep "one card per page" sticky across size switches: if copies is the
          // current size's per-page count, retarget it to the new size's (9 poker
          // ↔ 6 tarot) instead of stranding the old number.
          if (copies === getPageLayout(cardSize).cardsPerPage) {
            copies = getPageLayout(s).cardsPerPage;
          }
          cardSize = s;
        }}
        onCopiesChange={(n) => { copies = n; }}
        onGroupByElementChange={(on) => { groupByElement = on; }}
        onGroupByLetterChange={(on) => { groupByLetter = on; }}
        onRerender={() => { rerenderKey++; }}
        onPairsReady={(pairs) => { renderedPairs = pairs; }}
        onRenderStateChange={(s) => { isRendering = s.isRendering; renderProgress = s.progress; }}
        onSwapCard={handleSwapCard}
        onRemoveCard={handleRemoveCard}
        allowRemove={rs.deckMode === "loop"}
        onRedraw={handleRedraw}
        onRefresh={handleRefreshGallery}
        onRelease={openReleaseModal}
        onRename={rs.viewingRelease !== null ? handleRenameDeck : undefined}
        onBack={() => {
          rs.viewingRelease = null;
          rs.themeOverride = null;
          rs.bluePropOverride = null;
          rs.redPropOverride = null;
          rs.step = "configure";
          rs.persist();
        }}
      />
    {:else if rs.step === "released"}
      <div class="released-step">
        <div class="released-card">
          <div class="released-icon">
            <i class="fas fa-check-circle" aria-hidden="true"></i>
          </div>
          <h2 class="released-title">
            Deck #{String(rs.releasedNumber).padStart(3, "0")} Released
          </h2>
          <p class="released-notes">{rs.name}</p>
          {#if rs.description}
            <p class="released-description">{rs.description}</p>
          {/if}
          <p class="released-detail">{rs.cards.length} cards saved to Firebase</p>
          <div class="released-actions">
            <button type="button" class="new-deck-btn" onclick={handleStartNew}>
              <i class="fas fa-plus" aria-hidden="true"></i>
              Compose Another Deck
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="releaser-sidebar" class:print-mode={sidebarMode === "print"}>
    <div class="sidebar-switch">
      <SegmentedControl
        options={[
          { value: "browse", label: "Browse" },
          { value: "print", label: "Print" },
        ]}
        value={sidebarMode}
        onchange={(v) => { sidebarMode = v; }}
        color="accent"
        size="sm"
      />
    </div>

    {#if sidebarMode === "browse"}
      <div class="sidebar-body">
        <GeneratedArchivePanel
          decks={archivedDecks}
          isLoading={isLoadingArchive}
          activeRefNumber={rs.viewingRelease === null && rs.step === "review" ? rs.referenceNumber : null}
          onOpen={openArchivedDeck}
          onDelete={handleDeleteArchived}
        />
        <ReleaseHistoryPanel
          title="Timing &amp; Direction Decks"
          releases={tndReleases}
          isLoading={isLoadingReleases}
          activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
          onSelectRelease={handleSelectRelease}
          onDeleteRelease={handleDeleteRelease}
          onReuseRecipe={handleReuseRecipe}
        />
        {#if galleryReleases.length > 0}
          <ReleaseHistoryPanel
            title="Gallery Decks"
            releases={galleryReleases}
            isLoading={isLoadingReleases}
            activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
            onSelectRelease={handleSelectRelease}
            onDeleteRelease={handleDeleteRelease}
            onReuseRecipe={handleReuseRecipe}
          />
        {/if}
        {#if loopReleases.length > 0}
          <ReleaseHistoryPanel
            title="Released Decks"
            releases={loopReleases}
            isLoading={isLoadingReleases}
            activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
            onSelectRelease={handleSelectRelease}
            onDeleteRelease={handleDeleteRelease}
            onReuseRecipe={handleReuseRecipe}
          />
        {/if}
      </div>
      {#if rs.step === "review" && rs.viewingRelease === null}
        <div class="sidebar-footer">
          <button type="button" class="release-btn" onclick={openReleaseModal} disabled={rs.isReleasing || isRendering}>
            {#if rs.isReleasing}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Releasing…
            {:else}
              <i class="fas fa-stamp" aria-hidden="true"></i>
              Release Deck #{String(rs.nextDeckNumber).padStart(3, "0")}
            {/if}
          </button>
        </div>
      {/if}
    {:else}
      <div class="sidebar-body">
        {#if rs.step === "review" && rs.cards.length > 0}
          <PrintPanel
            cardCount={rs.cards.length}
            {tndElements}
            {cardSize}
            {copies}
            {groupByElement}
            theme={rs.theme}
            {selectedSide}
            onSideChange={(s) => { selectedSide = s; }}
            {isExporting}
            {isPrinting}
            {isRendering}
            {exportProgress}
            {exportTotal}
            {exportError}
            onPrint={handlePrint}
            onExportPDF={handleExportPDF}
            onExportZIP={handleExportZIP}
            onExportBoth={handleExportFrontsAndBacks}
          />
        {:else}
          <div class="sidebar-empty">
            <i class="fas fa-print" aria-hidden="true"></i>
            <span>Compose or open a deck to print.</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<DeckReleaseNameModal
  bind:open={showNameModal}
  deckNumber={rs.nextDeckNumber}
  initialName={rs.name}
  initialDescription={rs.description}
  isReleasing={rs.isReleasing}
  onConfirm={handleConfirmRelease}
  onCancel={() => { if (!rs.isReleasing) showNameModal = false; }}
/>

<style>
  .deck-releaser {
    display: flex;
    height: 100%;
    min-height: 0;
  }

  .releaser-main {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }

  .releaser-sidebar {
    width: clamp(300px, 22vw, 440px);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .sidebar-switch {
    padding: 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .sidebar-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  /* Browse = two stacked sections (Generated · Released), each scrolls its own list. */
  .sidebar-body > :global(.archive-panel),
  .sidebar-body > :global(.release-history) { flex: 1 1 0; min-height: 0; }
  .sidebar-body > :global(.archive-panel) { border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08)); }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .sidebar-footer .release-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    background: var(--semantic-success, #10b981);
    border: none;
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s;
  }

  .sidebar-footer .release-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .sidebar-footer .release-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 13px;
    text-align: center;
  }

  .sidebar-empty i { font-size: 24px; }

  .released-step {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 32px;
  }

  .released-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 400px;
    padding: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    text-align: center;
  }

  .released-icon {
    font-size: 48px;
    color: var(--semantic-success, #10b981);
  }

  .released-title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #fff);
  }

  .released-detail {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .released-notes {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
  }

  .released-description {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .released-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .new-deck-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 24px;
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .new-deck-btn:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 900px) {
    .deck-releaser {
      flex-direction: column;
    }

    .releaser-sidebar {
      width: 100%;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
      border-left: none;
      max-height: 320px;
    }
    .releaser-sidebar.print-mode { max-height: none; }
  }
</style>
