/**
 * Simple Browse State
 *
 * Essential gallery functionality without over-engineering.
 * Load sequences → Filter sequences → Display grid + Spotlight
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { container } from "$lib/shared/di";
import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { IBrowseFilter } from "../../sequences/display/services/contracts/IBrowseFilter";
import type { IBrowseLoader } from "../../sequences/display/services/contracts/IBrowseLoader";
import type { IBrowseSorter } from "../../sequences/display/services/contracts/IBrowseSorter";
import type { IMultiFilter } from "../../sequences/display/services/contracts/IMultiFilter";
import type {
  ActiveFilter,
  SerializedFilters,
} from "../domain/models/multi-filter-models";
import type { BrowseNavigationConfig } from "../../sequences/navigation/domain/models/navigation-models";
import type { BrowseNavigationItem } from "../../sequences/navigation/domain/models/navigation-models";
import type { INavigator } from "../../sequences/navigation/services/contracts/INavigator";
import { BrowseSortMethod } from "../domain/enums/browse-enums";
import type {
  SectionConfig,
  SequenceSection,
} from "../domain/models/browse-models";
import type { BrowseFilterValue } from "../domain/types/browse-types";
import type { ISectionManager } from "../services/contracts/ISectionManager";
import type { ILibraryRepository } from "../../../library/services/contracts/ILibraryRepository";
import type { SequenceSource } from "../state/sequence-source-state.svelte";
import type { IFavoritesManager } from "../services/contracts/IFavoritesManager";
import type { SequenceFilterType } from "../state/sequence-controls-state.svelte";
import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
import { onLibraryMutated } from "$lib/shared/library/library-events";

const STORAGE_KEY = "tka-browse-gallery-controls";

interface PersistedControlsState {
  sortMethod: BrowseSortMethod;
  sortDirection: "asc" | "desc";
  filter: { type: SequenceFilterType; value: BrowseFilterValue };
  /** Multi-filter state — serialized Map entries. Falls back to single filter if absent. */
  activeFilters?: SerializedFilters;
}

function deduplicateById(sequences: SequenceData[]): SequenceData[] {
  const seen = new Set<string>();
  return sequences.filter((seq) => {
    if (seen.has(seq.id)) return false;
    seen.add(seq.id);
    return true;
  });
}

export function createBrowseState() {
  // Services - Use specialized services directly instead of orchestration layer
  const loaderService = container.items.browseLoader;
  const filterService = container.items.browseFilter;
  const multiFilterService = container.items.multiFilter as IMultiFilter;
  const sortService = container.items.browseSorter;
  const Navigator = container.items.browseNavigator;
  const SectionManager = container.items.browseSectionManager;
  const FavoritesManager = container.items.favoritesManager;

  // Library service for "My Library" mode - lazily resolved
  let libraryService: ILibraryRepository | null = null;
  function getLibraryRepository(): ILibraryRepository | null {
    if (!libraryService) {
      libraryService = container.items.libraryRepository;
    }
    return libraryService;
  }

  // Load persisted controls state
  function loadPersistedControls(): PersistedControlsState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.warn("[BrowseState] Failed to load persisted controls:", error);
      return null;
    }
  }

  // Persist controls state
  function persistControls(): void {
    try {
      const state: PersistedControlsState = {
        sortMethod: currentSortMethod,
        sortDirection,
        filter: currentFilter,
        activeFilters: Array.from(activeFilters.entries()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("[BrowseState] Failed to persist controls:", error);
    }
  }

  const persisted = loadPersistedControls();

  // Per-source sequence cache — restores data instantly when switching back
  // without a Firestore round-trip. Invalidated on library mutation.
  let libraryCache: SequenceData[] | null = null;

  // State
  let isLoading = $state(false);
  let currentSource = $state<SequenceSource>("community");
  let error = $state<string | null>(null);
  let displayedSequences = $state<SequenceData[]>([]);
  let allSequences = $state<SequenceData[]>([]);
  let selectedSequence = $state<SequenceData | null>(null);
  let navigationSections = $state<BrowseNavigationConfig[]>([]);
  let sequenceSections = $state<SequenceSection[]>([]);
  let currentSortMethod = $state<BrowseSortMethod>(
    persisted?.sortMethod || BrowseSortMethod.ALPHABETICAL
  );
  let sortDirection = $state<"asc" | "desc">(persisted?.sortDirection || "asc");
  const showSections = $state<boolean>(true);
  let currentFilter = $state<{ type: SequenceFilterType; value: BrowseFilterValue }>(
    persisted?.filter || {
      type: "all",
      value: null,
    }
  );

  // Multi-filter state — keyed by filter type string
  let activeFilters = $state<Map<string, ActiveFilter>>(
    persisted?.activeFilters
      ? new Map(persisted.activeFilters)
      : new Map()
  );

  let filteredSequences = $state<SequenceData[]>([]);
  let isFilterModalOpen = $state<boolean>(false);
  let sectionsReady = $state<boolean>(false);

  // Animation modal state
  let isAnimationModalOpen = $state<boolean>(false);
  let sequenceToAnimate = $state<SequenceData | null>(null);

  // Computed: Available sections for simple navigation
  const availableNavigationSections = $derived(
    sequenceSections.map((section) => section.title)
  );

  // Computed: Available sequence lengths for filtering
  const availableSequenceLengths = $derived.by(() => {
    const lengths = new Set<number>();
    allSequences.forEach((seq) => {
      if (!seq.steps) return;
      // Calculate correct sequence length: steps.length - 2
      // Subtract 2 for metadata beat and start position beat
      const length = seq.steps.length - 2;
      if (length > 0) {
        lengths.add(length);
      }
    });
    return Array.from(lengths).sort((a, b) => a - b);
  });

  // Computed: LOOP type counts for filtering
  const loopTypeCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    let circularCount = 0;
    const total = allSequences.length;

    for (const seq of allSequences) {
      if (seq.isCircular) {
        circularCount++;
        if (seq.loopType) {
          counts[seq.loopType] = (counts[seq.loopType] ?? 0) + 1;
        }
      }
    }

    // Add meta counts for filtering options
    counts["_total"] = total;
    counts["_circular"] = circularCount;
    counts["_non_circular"] = total - circularCount;

    return counts;
  });

  // Multi-filter computed properties
  const hasActiveFilters = $derived(activeFilters.size > 0);
  const activeFilterCount = $derived(activeFilters.size);
  const activeFilterList = $derived(Array.from(activeFilters.values()));

  /**
   * Get contextual count: how many sequences would match if a candidate
   * filter were added, given other active filters.
   * Call this lazily (only when a dropdown is open) to avoid unnecessary computation.
   */
  function getFilteredCount(
    candidateType: BrowseFilterType,
    candidateValue: BrowseFilterValue
  ): number {
    return multiFilterService.getFilteredCount(
      allSequences,
      candidateType,
      candidateValue,
      activeFilters
    );
  }

  // Fetches community sequences from Firestore (or a cached result if already loaded).
  // This is the raw fetch — it only loads data. It doesn't update currentSource or
  // skip redundant calls if data is already loaded. Use setSource("community") instead,
  // which handles both of those before calling this internally.
  async function loadAllSequences(): Promise<void> {
    try {
      isLoading = true;
      sectionsReady = false;
      sequenceSections = []; // Clear immediately to prevent showing stale sections
      error = null;
      const sequences = await loaderService.loadSequenceMetadata();
      const dedupedSequences = deduplicateById(sequences);
      allSequences = dedupedSequences;
      displayedSequences = dedupedSequences;
      const sections = Navigator.generateNavigationSections(sequences, []);
      navigationSections = sections;
      applyFilterAndSort();
      await generateSequenceSections();
      sectionsReady = true;
    } catch (err) {
      console.error("Failed to load sequences:", err);
      error = err instanceof Error ? err.message : "Failed to load sequences";
    } finally {
      isLoading = false;
    }
  }

  // Fetches the user's library sequences from Firestore (or a cached result if already loaded).
  // This is the raw fetch — it only loads data. It doesn't update currentSource or
  // skip redundant calls if data is already loaded. Use setSource("my-library") instead,
  // which handles both of those before calling this internally.
  // To force a fresh Firestore fetch (e.g. when the impersonated user changes),
  // call invalidateLibraryCache() first.
  async function loadLibrarySequences(): Promise<void> {
    if (libraryCache) {
      allSequences = libraryCache;
      displayedSequences = libraryCache;
      applyFilterAndSort();
      await generateSequenceSections();
      sectionsReady = true;
      return;
    }

    const libService = getLibraryRepository();
    if (!libService) {
      error = "Please sign in to view your library";
      allSequences = [];
      displayedSequences = [];
      sequenceSections = [];
      sectionsReady = false;
      return;
    }

    try {
      isLoading = true;
      sectionsReady = false;
      sequenceSections = []; // Clear immediately to prevent showing stale sections
      error = null;
      const librarySequences = await libService.getSequences();
      // LibrarySequence extends SequenceData, so this is compatible
      const dedupedLibrary = deduplicateById(librarySequences);
      allSequences = dedupedLibrary;
      displayedSequences = dedupedLibrary;
      const sections = Navigator.generateNavigationSections(
        librarySequences,
        []
      );
      navigationSections = sections;
      applyFilterAndSort();
      await generateSequenceSections();
      sectionsReady = true;
      libraryCache = dedupedLibrary; // Cache for instant restore on tab switch
    } catch (err) {
      console.error("Failed to load library sequences:", err);
      error = err instanceof Error ? err.message : "Failed to load library";
    } finally {
      isLoading = false;
    }
  }

  // Switch source and reload data
  async function setSource(source: SequenceSource): Promise<void> {
    // Skip if we're already showing this source and the data is loaded.
    // sectionsReady is required because currentSource starts as "community" before
    // any data has been fetched — without it, the first setSource("community") call
    // would see a matching source and return immediately without loading anything.
    if (source === currentSource && sectionsReady) {
      return;
    }

    currentSource = source;

    if (source === "my-library") {
      await loadLibrarySequences();
    } else {
      // Community: PublicSequencesLoader has its own in-memory cache, so this is fast
      await loadAllSequences();
    }
  }

  // Filter sequences by navigation item
  function setActiveGalleryNavigationItem(
    sectionId: string,
    itemId: string
  ): void {
    const section = navigationSections.find((s) => s.id === sectionId);
    if (!section) return;

    const item = section.items.find(
      (i: BrowseNavigationItem) => i.id === itemId
    );
    if (!item) return;

    // Update active state
    navigationSections = navigationSections.map((s) => ({
      ...s,
      items: s.items.map((i: BrowseNavigationItem) => ({
        ...i,
        isActive: s.id === sectionId && i.id === itemId,
      })),
    }));

    // Filter sequences
    const filtered = Navigator.getSequencesForNavigationItem(
      item,
      section.type,
      allSequences
    );
    displayedSequences = filtered;
  }

  // Simple methods
  function selectSequence(sequence: SequenceData): void {
    selectedSequence = sequence;
  }

  async function toggleFavorite(sequenceId: string): Promise<void> {
    if (!FavoritesManager) {
      return;
    }

    try {
      // Toggle in the service (persists to storage)
      await FavoritesManager.toggleFavorite(sequenceId);

      // Get the new favorite status
      const isFavorite = await FavoritesManager.isFavorite(sequenceId);

      // Update local state - find and update the sequence in all relevant arrays
      const updateSequence = (seq: SequenceData) =>
        seq.id === sequenceId ? { ...seq, isFavorite } : seq;

      allSequences = allSequences.map(updateSequence);
      displayedSequences = displayedSequences.map(updateSequence);
      filteredSequences = filteredSequences.map(updateSequence);

      // Also update sections if they contain the sequence
      sequenceSections = sequenceSections.map((section) => ({
        ...section,
        sequences: section.sequences.map(updateSequence),
      }));

      // Update selected sequence if it's the one being toggled
      if (selectedSequence?.id === sequenceId) {
        selectedSequence = { ...selectedSequence, isFavorite };
      }

      // Update the active sequence in the panel manager (for detail panel)
      const updatedSequence = allSequences.find((s) => s.id === sequenceId);
      if (updatedSequence) {
        sequencePanelManager.updateActiveSequence(updatedSequence);
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      throw err;
    }
  }

  function clearError(): void {
    error = null;
  }

  // Apply filtering and sorting to sequences
  function applyFilterAndSort(): void {
    try {
      let filtered = allSequences;

      // Use multi-filter when active, fall back to single filter for compat
      if (activeFilters.size > 0) {
        filtered = multiFilterService.applyFilters(allSequences, activeFilters);
      } else if (currentFilter.type !== "all") {
        filtered = filterService.applyFilter(
          allSequences,
          currentFilter.type as BrowseFilterType,
          currentFilter.value
        );
      }

      // Apply sorting
      const sorted = sortService.sortSequences(filtered, currentSortMethod);

      if (sortDirection === "desc") {
        sorted.reverse();
      }

      filteredSequences = sorted;
      displayedSequences = sorted;
    } catch (err) {
      console.error("Failed to apply filter and sort:", err);
    }
  }

  // Generate sequence sections based on current sort method
  async function generateSequenceSections(): Promise<void> {
    try {
      // Map sort method to groupBy strategy
      let groupBy: SectionConfig["groupBy"];
      switch (currentSortMethod) {
        case BrowseSortMethod.ALPHABETICAL:
          groupBy = "letter";
          break;
        case BrowseSortMethod.DIFFICULTY_LEVEL:
          groupBy = "difficulty";
          break;
        case BrowseSortMethod.SEQUENCE_LENGTH:
          groupBy = "length";
          break;
        case BrowseSortMethod.DATE_ADDED:
          groupBy = "date";
          break;
        default:
          groupBy = "letter";
      }

      const config: SectionConfig = {
        groupBy,
        sortMethod: currentSortMethod,
        showEmptySections: false,
        expandedSections: new Set<string>(), // All sections always visible now
      };

      const sections = await SectionManager.organizeSections(
        filteredSequences,
        config
      );
      sequenceSections = sections;
    } catch (err) {
      console.error("Failed to generate sequence sections:", err);
    }
  }

  // Handle filter changes (single-filter backwards compat path)
  async function handleFilterChange(
    type: SequenceFilterType,
    value?: BrowseFilterValue
  ): Promise<void> {
    currentFilter = { type, value: value || null };

    // Sync single-filter with multi-filter map
    if (type === "all") {
      activeFilters = new Map();
    } else {
      // Replace filter of same type in multi-filter map
      const newMap = new Map(activeFilters);
      newMap.set(type, {
        type: type as unknown as BrowseFilterType,
        value: value || null,
        label: deriveFilterLabel(type, value || null),
        chipColor: deriveChipColor(type),
      });
      activeFilters = newMap;
    }

    sectionsReady = false;
    sequenceSections = [];
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
    sectionsReady = true;
  }

  // Multi-filter API: add a filter (replaces existing filter of same type)
  async function addFilter(
    type: SequenceFilterType,
    value: BrowseFilterValue,
    label: string,
    color: string
  ): Promise<void> {
    const newMap = new Map(activeFilters);
    newMap.set(type, {
      type: type as unknown as BrowseFilterType,
      value,
      label,
      chipColor: color,
    });
    activeFilters = newMap;

    // Keep single-filter in sync (first active filter)
    syncCurrentFilterFromMap();

    sectionsReady = false;
    sequenceSections = [];
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
    sectionsReady = true;
  }

  // Multi-filter API: remove a specific filter type
  async function removeFilter(type: string): Promise<void> {
    const newMap = new Map(activeFilters);
    newMap.delete(type);
    activeFilters = newMap;

    syncCurrentFilterFromMap();

    sectionsReady = false;
    sequenceSections = [];
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
    sectionsReady = true;
  }

  // Multi-filter API: clear all filters
  async function clearAllFilters(): Promise<void> {
    activeFilters = new Map();
    currentFilter = { type: "all", value: null };

    sectionsReady = false;
    sequenceSections = [];
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
    sectionsReady = true;
  }

  // Sync the backwards-compat single currentFilter from the multi-filter map
  function syncCurrentFilterFromMap(): void {
    if (activeFilters.size === 0) {
      currentFilter = { type: "all", value: null };
    } else {
      // Use the first filter entry for backwards compat
      const first = activeFilters.values().next().value;
      if (first) {
        currentFilter = {
          type: first.type as unknown as SequenceFilterType,
          value: first.value,
        };
      }
    }
  }

  // Derive human-readable filter label from type and value
  function deriveFilterLabel(type: SequenceFilterType, value: BrowseFilterValue): string {
    if (type === "favorites") return "Favorites";
    if (type === "difficulty") return `Level ${value}`;
    if (type === "startingLetter" || type === "starting_letter") return `Letter ${value}`;
    if (type === "length") return `${value} beats`;
    if (type === "startPosition" || type === "startingPosition") return `Start: ${value}`;
    if (type === "endPosition") return `End: ${value}`;
    if (type === "contains_letters") return `"${value}"`;
    if (type === "cap_type") return `Pattern: ${value}`;
    if (type === "recent") return "Recent";
    return String(type);
  }

  // Derive chip color from filter type
  function deriveChipColor(type: SequenceFilterType): string {
    switch (type) {
      case "difficulty": return "var(--semantic-info)";
      case "favorites": return "#ec4899";
      case "startingLetter":
      case "starting_letter": return "#10b981";
      case "length": return "#f59e0b";
      case "cap_type": return "#8b5cf6";
      case "startPosition":
      case "startingPosition":
      case "endPosition": return "#06b6d4";
      case "contains_letters": return "var(--semantic-info)";
      case "recent": return "#f97316";
      default: return "var(--theme-accent)";
    }
  }

  // Handle sort changes
  async function handleSortChange(
    method: BrowseSortMethod,
    direction: "asc" | "desc"
  ): Promise<void> {
    currentSortMethod = method;
    sortDirection = direction;
    sectionsReady = false;
    sequenceSections = []; // Clear immediately to prevent showing stale sections
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
    sectionsReady = true;
  }

  // Handle filter modal
  function openFilterModal(): void {
    isFilterModalOpen = true;
  }

  function closeFilterModal(): void {
    isFilterModalOpen = false;
  }

  // Toggle sequence section expansion
  function toggleSequenceSection(sectionId: string): void {
    sequenceSections = SectionManager.toggleSectionExpansion(
      sectionId,
      sequenceSections
    );
  }

  // Navigation section expansion
  function toggleNavigationSection(sectionId: string): void {
    navigationSections = Navigator.toggleSectionExpansion(
      sectionId,
      navigationSections
    );
  }

  // Scroll to section (for simple navigation)
  function scrollToSection(sectionTitle: string): void {
    const sectionElement = document.querySelector(
      `[data-section="${sectionTitle}"]`
    );

    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Stub methods for compatibility
  function backToFilters(): void {
    /* Not needed */
  }

  // Animation modal functions
  function openAnimationModal(sequence: SequenceData): void {
    sequenceToAnimate = sequence;
    isAnimationModalOpen = true;
  }

  function closeAnimationModal(): void {
    isAnimationModalOpen = false;
    // Keep sequenceToAnimate briefly for smooth transition
    setTimeout(() => {
      sequenceToAnimate = null;
    }, 300);
  }

  // When a sequence is deleted from anywhere (e.g. sequence viewer),
  // remove it from both caches and the displayed list — no Firestore round-trip.
  $effect(() => {
    return onLibraryMutated((sequenceId) => {
      libraryCache = libraryCache?.filter((s) => s.id !== sequenceId) ?? null;
      loaderService.removeFromCache(sequenceId);
      allSequences = allSequences.filter((s) => s.id !== sequenceId);
      applyFilterAndSort();
      generateSequenceSections();
    });
  });

  return {
    // State
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get displayedSequences() {
      return displayedSequences;
    },
    get allSequences() {
      return allSequences;
    },
    get selectedSequence() {
      return selectedSequence;
    },
    get navigationSections() {
      return navigationSections;
    },
    get sequenceSections() {
      return sequenceSections;
    },
    get showSections() {
      return showSections;
    },
    get currentSortMethod() {
      return currentSortMethod;
    },
    get sortDirection() {
      return sortDirection;
    },
    get currentFilter() {
      return currentFilter;
    },
    get filteredSequences() {
      return filteredSequences;
    },
    get isFilterModalOpen() {
      return isFilterModalOpen;
    },
    get availableNavigationSections() {
      return availableNavigationSections;
    },
    get availableSequenceLengths() {
      return availableSequenceLengths;
    },
    get loopTypeCounts() {
      return loopTypeCounts;
    },
    get isAnimationModalOpen() {
      return isAnimationModalOpen;
    },
    get sequenceToAnimate() {
      return sequenceToAnimate;
    },
    get currentSource() {
      return currentSource;
    },
    get sectionsReady() {
      return sectionsReady;
    },

    // Multi-filter state
    get activeFilters() {
      return activeFilters;
    },
    get hasActiveFilters() {
      return hasActiveFilters;
    },
    get activeFilterCount() {
      return activeFilterCount;
    },
    get activeFilterList() {
      return activeFilterList;
    },

    // Methods
    loadAllSequences,
    loadLibrarySequences,
    invalidateLibraryCache() { libraryCache = null; },
    setSource,
    selectSequence,
    toggleFavorite,
    clearError,
    setActiveGalleryNavigationItem,
    generateSequenceSections,
    toggleSequenceSection,
    handleFilterChange,
    handleSortChange,
    openFilterModal,
    closeFilterModal,
    scrollToSection,
    openAnimationModal,
    closeAnimationModal,

    // Multi-filter methods
    addFilter,
    removeFilter,
    clearAllFilters,
    getFilteredCount,

    // Compatibility stubs
    backToFilters,
    toggleNavigationSection,
  };
}
