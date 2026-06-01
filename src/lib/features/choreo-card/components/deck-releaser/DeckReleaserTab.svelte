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
  } from "../../services/deck-composer";
  import type { DeckRelease, DeckReleaseCard, DeckRecipe } from "../../domain/models/DeckRelease";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getNextDeckNumber, releaseDeck, getAllReleases, updateDeckMeta, deleteDeck } from "../../services/deck-release-store";
  import ConfigureStep from "./ConfigureStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";
  import ReleaseHistoryPanel from "./ReleaseHistoryPanel.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import PrintPanel from "../print-preview/PrintPanel.svelte";
  import DeckReleaseNameModal from "./DeckReleaseNameModal.svelte";
  import { releaserState as rs } from "./deck-releaser-state.svelte";
  import { resolveDeckSequences, applyVariationDescriptor, rollVariation } from "../../services/deck-variation";
  import { loadDiamondEdges } from "../../services/pictograph-letter-lookup";
  import { prewarmCardPool } from "$lib/shared/render/services/card-pool-prewarm";
  import { hashDeckContent, hashSequenceContent } from "$lib/shared/foundation/services/content-hasher";
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { getTnDElementByIconPath, TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";
  import { suggestCopyCounts, copyWaste } from "../../services/print-copy-suggester";
  import { buildDeckAiSummary } from "../../services/deck-ai-summary";
  import type { CardPair } from "../../services/types";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";
  import type { PrintSide } from "../print-preview/PrintPanel.svelte";

  interface Props {
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
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
  let pool = $state<Map<number, { sequenceId: string; sourceCatalogId: string; stepCount: number; word: string }[]>>(new Map());
  let releasedIds = $state<Set<string>>(new Set());
  let releases = $state<DeckRelease[]>([]);
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
  let renderTotal = $state(0);
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
    const deckName = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
    return [deckName, mode, copies, groupByElement, printDeckSig].join("§");
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

  async function handleExportPDF(mode: PrintPDFMode = "combined") {
    if (renderedPairs.length === 0) return;
    isExporting = true; exportError = ""; exportProgress = 0; exportTotal = 0;
    try {
      const { getOrBuildPrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-cache");
      const deckName = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
      const copiesSuffix = copies > 1 ? `_x${copies}` : "";
      const suffix = (mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print") + copiesSuffix;
      const blob = await getOrBuildPrintPDF(buildPrintKey(mode), renderedPairs, deckName, cardSize, mode,
        { copies, elements: tndElements, groupByElement }, (current, total) => {
          exportProgress = current; exportTotal = total;
        });
      triggerDownload(blob, `${deckName}${suffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false; exportProgress = 0; exportTotal = 0;
    }
  }

  async function handlePrint(mode: PrintPDFMode) {
    if (renderedPairs.length === 0 || isPrinting) return;
    isPrinting = true; exportError = "";
    try {
      const { getOrBuildPrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-cache");
      const { printPdfBlob } = await import("$lib/features/choreo-card/services/print-blob");
      const deckLabel = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
      const blob = await getOrBuildPrintPDF(buildPrintKey(mode), renderedPairs, deckLabel, cardSize, mode,
        { copies, elements: tndElements, groupByElement });
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
      const { exportDeckZIP } = await import("$lib/features/choreo-card/services/print-zip-exporter");
      const deckName = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
      const blob = await exportDeckZIP(renderedPairs, deckName, (current, total) => {
        exportProgress = current; exportTotal = total;
      });
      triggerDownload(blob, `${deckName}_cards.zip`);
    } catch (e) {
      exportError = `ZIP export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false; exportProgress = 0; exportTotal = 0;
    }
  }

  function rebuildPool() {
    const filter: CatalogPoolFilter = { sliceTypes: rs.selectedSliceTypes };
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

  function handleModeChange(mode: 'loop' | 'tnd') {
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
    // Target deck size is the FINAL count. Registers × grid modes each duplicate
    // every base card, so compose `base = target / multiplier` and let the
    // enumeration below fan it back up to ~target (e.g. 52 target + radial &
    // nonradial → 26 base × 2 = 52 out, not 104).
    const { base } = loopDrawCounts(rs.totalCards, registers.length, grids.length);
    const cards = composeDeck(pool, rs.weights, base, { center: rs.notes });
    // Full enumeration: each composed card is emitted once per (register × grid
    // mode), sharing the same rolled reversal/turn so register/grid are pure axes.
    const out: DeckReleaseCard[] = [];
    let position = 1;
    for (const c of cards) {
      const rolled = rollVariation(c.stepCount, rs.variationConfig, Math.random);
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

  async function handleDraw() {
    const gen = ++rs.drawGeneration;
    // Fresh draw = a new, not-yet-named deck. Clear any name left over from a
    // previously composed/released deck so the header shows the placeholder, not
    // the last deck's title.
    rs.name = "";
    rs.cards = composeFullDeck();
    if (await bounceIfDuplicate()) return;
    await loadSelectedSequences(gen);
    if (gen !== rs.drawGeneration) return;
    rs.step = "review";
    rs.persist();
  }

  async function handleRedraw() {
    const gen = ++rs.drawGeneration;
    rs.cards = composeFullDeck();
    if (await bounceIfDuplicate()) return;
    await loadSelectedSequences(gen);
    if (gen !== rs.drawGeneration) return;
    rs.persist();
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
        const loaded = await loadSequencesByIds(catalogId, seqIds);
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
    toast.success("Recipe loaded — tweak or press Draw for a fresh deck.");
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
    rs.bluePropOverride = (release.bluePropType as PropType | undefined) ?? null;
    rs.redPropOverride = (release.redPropType as PropType | undefined) ?? null;
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
      />
    {:else if rs.step === "review"}
      <ReviewStep
        cards={rs.cards}
        sequences={rs.sequences}
        theme={rs.theme}
        bluePropType={rs.bluePropType}
        redPropType={rs.redPropType}
        nextDeckNumber={rs.nextDeckNumber}
        deckName={rs.name}
        isReleasing={rs.isReleasing}
        readOnly={rs.viewingRelease !== null}
        brokenLoopCount={rs.brokenLoopCount}
        showRedraw={rs.deckMode === "loop"}
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
        onRenderStateChange={(s) => { isRendering = s.isRendering; renderProgress = s.progress; renderTotal = s.total; }}
        onSwapCard={handleSwapCard}
        onRedraw={handleRedraw}
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
        <ReleaseHistoryPanel
          {releases}
          isLoading={isLoadingReleases}
          activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
          onSelectRelease={handleSelectRelease}
          onDeleteRelease={handleDeleteRelease}
          onReuseRecipe={handleReuseRecipe}
        />
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
    background: #10b981;
    border: none;
    border-radius: 10px;
    color: #fff;
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
    color: #10b981;
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
