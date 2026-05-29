import type { Catalog } from "../domain/models/Catalog";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { CardSizeId } from "../domain/card-sizes";
import type { CardPair } from "../services/types";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

type ViewMode = "grid" | "print";

interface InteriorFilters {
  familyIds: string[];
  position: string | null;
}

export interface SequenceGroup {
  label: string;
  sequences: SequenceData[];
}

const START_POS_LABELS: Record<string, string> = {
  alpha: "Alpha (α)",
  beta: "Beta (β)",
  gamma: "Gamma (γ)",
};

export const PRINT_PREVIEW_MAX = 128;

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  const stored = localStorage.getItem("choreoCard.deckViewMode");
  if (stored === "cards" || stored === "print") return "print";
  return "grid";
}

export function createCatalogInteriorState() {
  let viewMode = $state<ViewMode>(readViewMode());
  let cardSize = $state<CardSizeId>(
    (typeof window !== "undefined" ? localStorage.getItem("cardPreview.cardSize") : null) as CardSizeId ?? "poker"
  );
  const selectedTheme = $derived(settingsService.settings.backgroundType ?? "cosmic");
  let isExporting = $state(false);
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let rerenderKey = $state(0);
  let inspectedSequence = $state<SequenceData | null>(null);
  let inspectedFrontImageUrl = $state<string | null>(null);
  let inspectedRerender = $state<(() => Promise<string | null>) | null>(null);

  let interiorFilters = $state<InteriorFilters>({ familyIds: [], position: null });
  let interiorFiltersOpen = $state(false);

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    if (typeof window !== "undefined") localStorage.setItem("choreoCard.deckViewMode", mode);
  }

  function setCardSize(size: CardSizeId) {
    cardSize = size;
    if (typeof window !== "undefined") localStorage.setItem("cardPreview.cardSize", size);
  }

  function resetFilters() {
    interiorFilters = { familyIds: [], position: null };
    interiorFiltersOpen = false;
  }

  function setFamilyFilter(ids: string[]) {
    interiorFilters = { ...interiorFilters, familyIds: ids };
  }

  function setPositionFilter(pos: string | null) {
    interiorFilters = { ...interiorFilters, position: pos };
  }

  function clearInspection() {
    inspectedSequence = null;
    inspectedFrontImageUrl = null;
    inspectedRerender = null;
  }

  function incrementRerenderKey() {
    rerenderKey++;
  }

  return {
    get viewMode() { return viewMode; },
    get cardSize() { return cardSize; },
    get selectedTheme() { return selectedTheme; },
    get isExporting() { return isExporting; },
    set isExporting(v: boolean) { isExporting = v; },
    get renderedPairs() { return renderedPairs; },
    set renderedPairs(v: CardPair[]) { renderedPairs = v; },
    get isRendering() { return isRendering; },
    set isRendering(v: boolean) { isRendering = v; },
    get renderProgress() { return renderProgress; },
    set renderProgress(v: number) { renderProgress = v; },
    get renderTotal() { return renderTotal; },
    set renderTotal(v: number) { renderTotal = v; },
    get rerenderKey() { return rerenderKey; },
    get inspectedSequence() { return inspectedSequence; },
    set inspectedSequence(v: SequenceData | null) { inspectedSequence = v; },
    get inspectedFrontImageUrl() { return inspectedFrontImageUrl; },
    set inspectedFrontImageUrl(v: string | null) { inspectedFrontImageUrl = v; },
    get inspectedRerender() { return inspectedRerender; },
    set inspectedRerender(v: (() => Promise<string | null>) | null) { inspectedRerender = v; },
    get interiorFilters() { return interiorFilters; },
    get interiorFiltersOpen() { return interiorFiltersOpen; },
    set interiorFiltersOpen(v: boolean) { interiorFiltersOpen = v; },
    setViewMode,
    setCardSize,
    resetFilters,
    setFamilyFilter,
    setPositionFilter,
    clearInspection,
    incrementRerenderKey,
    START_POS_LABELS,
  };
}

export function filterSequences(
  catalogSequences: SequenceData[],
  filters: InteriorFilters,
  catalog: Catalog | null,
): SequenceData[] {
  let seqs = catalogSequences;
  if (filters.familyIds.length > 0 && catalog) {
    const allowedIds = new Set(
      catalog.families
        .filter((f) => filters.familyIds.includes(f.id))
        .flatMap((f) => [...f.sequenceIds]),
    );
    seqs = seqs.filter((s) => allowedIds.has(s.id));
  }
  if (filters.position) {
    seqs = seqs.filter((s) => {
      const gridPos = s.startPosition?.gridPosition ?? s.startPosition?.startPosition ?? "";
      return gridPos.startsWith(filters.position!);
    });
  }
  return seqs;
}

export function groupByStartPosition(seqs: SequenceData[]): SequenceGroup[] {
  const groups: Record<string, SequenceData[]> = {};
  for (const seq of seqs) {
    const gridPos = seq.startPosition?.gridPosition ?? seq.startPosition?.startPosition ?? "";
    const group = gridPos.startsWith("alpha") ? "alpha"
      : gridPos.startsWith("beta") ? "beta"
      : gridPos.startsWith("gamma") ? "gamma"
      : "other";
    if (!groups[group]) groups[group] = [];
    groups[group]!.push(seq);
  }
  return ["alpha", "beta", "gamma"]
    .filter((g) => groups[g] && groups[g]!.length > 0)
    .map((g) => ({ label: START_POS_LABELS[g] ?? g, sequences: groups[g]! }));
}

export function groupByFamily(seqs: SequenceData[], catalog: Catalog): SequenceGroup[] {
  const seqMap = new Map(seqs.map((s) => [s.id, s]));
  return catalog.families
    .map((f) => ({
      label: f.label || f.typeCombo,
      sequences: f.sequenceIds
        .map((id) => seqMap.get(id))
        .filter((s): s is SequenceData => s !== undefined),
    }))
    .filter((g) => g.sequences.length > 0);
}

export function formatCount(n: number): string {
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export type CatalogInteriorState = ReturnType<typeof createCatalogInteriorState>;
