import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { hashSequenceContent } from "$lib/shared/foundation/services/content-hasher";
import type { CardSizeId } from "../../../domain/card-sizes";
import { getPageLayout } from "../../../domain/card-sizes";
import { buildDeckAiSummary } from "../../../services/deck-ai-summary";
import type { PrintPDFMode } from "../../../services/print-pdf-exporter";
import {
  copyWaste,
  suggestCopyCounts,
} from "../../../services/print-copy-suggester";
import type { CardPair } from "../../../services/types";
import type { PrintSide } from "../../print-preview/PrintPanel.svelte";
import {
  buildDeckPrintMetadata,
  normalizeDeckFooters,
  orderDeckForPrint,
} from "../deck-print-model";
import type { DeckReleaserSessionStorage } from "./deck-releaser-session";
import type { DeckReleaserState } from "./deck-releaser-state.svelte";

const PRINT_SETTINGS_KEY = "deckReleaser.printSettings";

interface PersistedPrintSettings {
  cardSize: CardSizeId;
  copies: number;
  groupByElement: boolean;
  groupByLetter?: boolean;
}

export interface DeckPrintStateDependencies {
  storage: DeckReleaserSessionStorage;
  download(blob: Blob, filename: string): void;
  renderInsertCardPair: typeof import("../../../services/PrintCardRenderer").renderInsertCardPair;
  getOrBuildPrintPDF: typeof import("../../../services/print-pdf-cache").getOrBuildPrintPDF;
  prepareSerializedPrintRun: typeof import("../../../services/serialized-print-run").prepareSerializedPrintRun;
  exportHomePrintPDF: typeof import("../../../services/print-pdf-exporter").exportHomePrintPDF;
  printPdfBlob(blob: Blob): void | Promise<void>;
  exportDeckZIP: typeof import("../../../services/print-zip-exporter").exportDeckZIP;
}

function loadPrintSettings(
  storage: DeckReleaserSessionStorage
): Partial<PersistedPrintSettings> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PRINT_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function createDeckPrintState(
  deck: DeckReleaserState,
  deps: DeckPrintStateDependencies
) {
  const saved = loadPrintSettings(deps.storage);
  let cardSize = $state<CardSizeId>(saved.cardSize ?? "poker");
  let copies = $state(saved.copies ?? getPageLayout(cardSize).cardsPerPage);
  let groupByElement = $state(saved.groupByElement ?? true);
  let groupByLetter = $state(saved.groupByLetter ?? false);
  let selectedSide = $state<PrintSide>("fronts");
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let isExporting = $state(false);
  let isPrinting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportError = $state("");
  let rerenderKey = $state(0);

  $effect(() => {
    if (!deps.storage) return;
    try {
      deps.storage.setItem(
        PRINT_SETTINGS_KEY,
        JSON.stringify({ cardSize, copies, groupByElement, groupByLetter })
      );
    } catch {
      // Printing still works when the browser refuses preference storage.
    }
  });

  const footers = $derived(normalizeDeckFooters(deck.cards));
  const ordered = $derived.by(() =>
    orderDeckForPrint(deck.sequences, footers, {
      groupByElement,
      groupByLetter,
    })
  );
  const sortedSequences = $derived(ordered.sequences as SequenceData[]);
  const sortedFooters = $derived(ordered.footers);
  const tndElements = $derived(ordered.tndElements);
  const renderTotal = $derived(sortedSequences.length);
  const deckRefNumber = $derived(
    deck.viewingRelease?.deckNumber ?? deck.referenceNumber
  );
  const deckRefPadded = $derived(String(deckRefNumber).padStart(3, "0"));
  const groupSizes = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const element of tndElements) {
      const key = element?.element ?? "__untagged__";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  const cardsPerPage = $derived(getPageLayout(cardSize).cardsPerPage);
  const copiesPresets = $derived.by(() => {
    const ladder = suggestCopyCounts(groupSizes, cardsPerPage).map(
      (suggestion) => suggestion.copies
    );
    const withFullSheet = ladder.includes(cardsPerPage)
      ? ladder
      : [...ladder, cardsPerPage];
    return withFullSheet.sort((left, right) => left - right);
  });

  function copiesAnnotate(value: number) {
    const waste = copyWaste(groupSizes, cardsPerPage, value);
    return { blanks: waste.blanks, perfect: waste.blanks === 0 };
  }

  function buildMetadata() {
    return buildDeckPrintMetadata({
      deckLabel: deck.name.trim() || `Deck #${deckRefPadded}`,
      deckRefPadded,
      sequences: sortedSequences,
      loopType: [...deck.selectedLoopTypes][0] ?? "rotated",
      level: [...deck.selectedLevels][0] ?? 1,
      period: [...deck.selectedSliceTypes][0] ?? "",
      selectedLength: deck.selectedLength,
      turnIntensity: deck.turnIntensity,
      gridMode: [...deck.selectedGridModes][0] ?? "diamond",
      propType: String(deck.bluePropType),
    });
  }

  const metadata = $derived(buildMetadata());

  function getAiSummary(): string {
    const waste = copyWaste(groupSizes, cardsPerPage, copies);
    return buildDeckAiSummary({
      name: deck.name,
      deckNumber: deck.viewingRelease?.deckNumber ?? deck.nextDeckNumber,
      isReleased: deck.viewingRelease != null,
      cards: deck.cards,
      layout: {
        cardSize,
        cardsPerPage,
        copies,
        groupByColor: groupByElement,
        groupByLetter,
        sheets: waste.sheets,
        blanks: waste.blanks,
      },
      recipe: deck.viewingRelease?.recipe ?? deck.toRecipe(),
    });
  }

  const printDeckSignature = $derived.by(() => {
    const cards = sortedSequences
      .map(
        (sequence, index) =>
          `${hashSequenceContent(sequence)}:${tndElements[index]?.element ?? "_"}`
      )
      .join(",");
    return [
      "v1",
      deck.theme,
      deck.bluePropType,
      deck.redPropType,
      cardSize,
      cards,
    ].join("|");
  });

  function buildPrintKey(mode: PrintPDFMode): string {
    return [
      `Deck_${deckRefPadded}`,
      mode,
      copies,
      groupByElement,
      printDeckSignature,
    ].join("§");
  }

  function physicalDeckIdentity() {
    const releaseNumber = deck.viewingRelease?.deckNumber ?? null;
    return {
      deckId: releaseNumber
        ? `release:${releaseNumber}`
        : `generated:${deckRefNumber}`,
      deckName: deck.name.trim() || `Deck #${deckRefPadded}`,
      deckReleaseNumber: releaseNumber,
    };
  }

  function metadataForPrintRun(printRunId: string) {
    return {
      ...metadata,
      subject: `${metadata.subject} Serialized artwork run ${printRunId}.`,
      keywords: [...metadata.keywords, `print-run:${printRunId}`],
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
        error
      );
    }
  }

  async function buildInsertPair(): Promise<CardPair> {
    const { front, back } = await deps.renderInsertCardPair({
      theme: deck.theme,
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

    if (mode === "backs") {
      const blob = await deps.getOrBuildPrintPDF(
        buildPrintKey(mode),
        renderedPairs,
        deckName,
        cardSize,
        mode,
        {
          copies,
          elements: tndElements,
          groupByElement,
          meta: metadata,
          insertPair: await buildInsertPair(),
        },
        onProgress
      );
      return { blob, printRunId: null };
    }

    const run = await deps.prepareSerializedPrintRun({
      pairs: renderedPairs,
      ...physicalDeckIdentity(),
      cardSize,
      copies,
      groupByElement,
      outputMode: mode,
    });
    let blob: Blob;
    try {
      blob = await deps.exportHomePrintPDF(
        renderedPairs,
        deckName,
        cardSize,
        onProgress,
        mode,
        {
          copies,
          elements: tndElements,
          groupByElement,
          meta: metadataForPrintRun(run.printRunId),
          insertPair: await buildInsertPair(),
          frontRenderer: ({ pair, cardIndex, copyIndex }) =>
            run.renderFront(pair, cardIndex, copyIndex),
        }
      );
    } catch (error) {
      await recordFailedPrintRun(run);
      throw error;
    }
    await run.complete();
    return { blob, printRunId: run.printRunId };
  }

  async function exportPDF(mode: PrintPDFMode = "combined"): Promise<void> {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const deckName = `Deck_${deckRefPadded}`;
      const copiesSuffix = copies > 1 ? `_x${copies}` : "";
      const modeSuffix =
        mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print";
      const { blob, printRunId } = await buildPrintPDF(mode);
      const runSuffix = printRunId ? `_run-${printRunId.slice(0, 8)}` : "";
      deps.download(
        blob,
        `${deckName}${modeSuffix}${copiesSuffix}${runSuffix}.pdf`
      );
    } catch (error) {
      exportError = `PDF export failed: ${error instanceof Error ? error.message : error}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }

  async function exportFrontsAndBacks(): Promise<void> {
    if (renderedPairs.length === 0 || isExporting) return;
    await exportPDF("fronts");
    await exportPDF("backs");
  }

  async function print(mode: PrintPDFMode): Promise<void> {
    if (renderedPairs.length === 0 || isPrinting) return;
    isPrinting = true;
    exportError = "";
    try {
      const { blob } = await buildPrintPDF(mode);
      await deps.printPdfBlob(blob);
    } catch (error) {
      exportError = `Print failed: ${error instanceof Error ? error.message : error}`;
    } finally {
      isPrinting = false;
    }
  }

  async function exportZIP(): Promise<void> {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const deckName = `Deck_${deckRefPadded}`;
      const run = await deps.prepareSerializedPrintRun({
        pairs: renderedPairs,
        ...physicalDeckIdentity(),
        cardSize,
        copies: 1,
        groupByElement,
        outputMode: "zip",
      });
      let blob: Blob;
      try {
        blob = await deps.exportDeckZIP(
          renderedPairs,
          deckName,
          (current, total) => {
            exportProgress = current;
            exportTotal = total;
          },
          {
            insertPair: await buildInsertPair(),
            frontRenderer: (pair, cardIndex) =>
              run.renderFront(pair, cardIndex, 0),
          }
        );
      } catch (error) {
        await recordFailedPrintRun(run);
        throw error;
      }
      await run.complete();
      deps.download(
        blob,
        `${deckName}_cards_run-${run.printRunId.slice(0, 8)}.zip`
      );
    } catch (error) {
      exportError = `ZIP export failed: ${error instanceof Error ? error.message : error}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }

  function changeCardSize(value: CardSizeId): void {
    if (copies === getPageLayout(cardSize).cardsPerPage) {
      copies = getPageLayout(value).cardsPerPage;
    }
    cardSize = value;
  }

  const previewSideFilter = $derived(
    selectedSide === "fronts"
      ? "fronts"
      : selectedSide === "backs"
        ? "backs"
        : null
  );

  return {
    get cardSize() {
      return cardSize;
    },
    get copies() {
      return copies;
    },
    set copies(value) {
      copies = value;
    },
    get groupByElement() {
      return groupByElement;
    },
    set groupByElement(value) {
      groupByElement = value;
    },
    get groupByLetter() {
      return groupByLetter;
    },
    set groupByLetter(value) {
      groupByLetter = value;
    },
    get selectedSide() {
      return selectedSide;
    },
    set selectedSide(value) {
      selectedSide = value;
    },
    get renderedPairs() {
      return renderedPairs;
    },
    set renderedPairs(value) {
      renderedPairs = value;
    },
    get isRendering() {
      return isRendering;
    },
    set isRendering(value) {
      isRendering = value;
    },
    get renderProgress() {
      return renderProgress;
    },
    set renderProgress(value) {
      renderProgress = value;
    },
    get isExporting() {
      return isExporting;
    },
    get isPrinting() {
      return isPrinting;
    },
    get exportProgress() {
      return exportProgress;
    },
    get exportTotal() {
      return exportTotal;
    },
    get exportError() {
      return exportError;
    },
    get rerenderKey() {
      return rerenderKey;
    },
    get footers() {
      return footers;
    },
    get sortedSequences() {
      return sortedSequences;
    },
    get sortedFooters() {
      return sortedFooters;
    },
    get tndElements() {
      return tndElements;
    },
    get renderTotal() {
      return renderTotal;
    },
    get deckRefNumber() {
      return deckRefNumber;
    },
    get copiesPresets() {
      return copiesPresets;
    },
    get metadata() {
      return metadata;
    },
    get previewSideFilter() {
      return previewSideFilter;
    },
    copiesAnnotate,
    getAiSummary,
    changeCardSize,
    requestRerender() {
      rerenderKey++;
    },
    setRenderState(state: { isRendering: boolean; progress: number }) {
      isRendering = state.isRendering;
      renderProgress = state.progress;
    },
    exportPDF,
    exportFrontsAndBacks,
    print,
    exportZIP,
  };
}

export type DeckPrintState = ReturnType<typeof createDeckPrintState>;
