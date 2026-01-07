/**
 * Simple Explore State
 *
 * Essential gallery functionality without over-engineering.
 * Load sequences → Filter sequences → Display grid + Spotlight
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { resolve, tryResolve } from "$lib/shared/inversify/di";
import { TYPES } from "$lib/shared/inversify/types";
import type { ExploreFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { IDiscoverFilter } from "../../gallery/display/services/contracts/IDiscoverFilter";
import type { IDiscoverLoader } from "../../gallery/display/services/contracts/IDiscoverLoader";
import type { IDiscoverSorter } from "../../gallery/display/services/contracts/IDiscoverSorter";
import type { ExploreNavigationConfig } from "../../gallery/navigation/domain/models/navigation-models";
import type { ExploreNavigationItem } from "../../gallery/navigation/domain/models/navigation-models";
import type { INavigator } from "../../gallery/navigation/services/contracts/INavigator";
import { ExploreSortMethod } from "../domain/enums/discover-enums";
import type {
  SectionConfig,
  SequenceSection,
} from "../domain/models/discover-models";
import type { ExploreFilterValue } from "../domain/types/discover-types";
import type { ISectionManager } from "../services/contracts/ISectionManager";
import type { ILibraryRepository } from "../../../library/services/contracts/ILibraryRepository";
import type { GallerySource } from "../state/gallery-source-state.svelte";
import type { IFavoritesManager } from "../services/contracts/IFavoritesManager";
import { galleryPanelManager } from "../state/gallery-panel-state.svelte";

const STORAGE_KEY = "tka-discover-gallery-controls";

interface PersistedControlsState {
  sortMethod: ExploreSortMethod;
  sortDirection: "asc" | "desc";
  filter: { type: string; value: ExploreFilterValue };
}

export function createExploreState() {
  // Services - Use specialized services directly instead of orchestration layer
  const loaderService = resolve<IDiscoverLoader>(TYPES.IDiscoverLoader);
  const filterService = resolve<IDiscoverFilter>(TYPES.IDiscoverFilter);
  const sortService = resolve<IDiscoverSorter>(TYPES.IDiscoverSorter);
  const Navigator = resolve<INavigator>(TYPES.INavigator);
  const SectionManager = resolve<ISectionManager>(TYPES.ISectionManager);
  const FavoritesManager = tryResolve<IFavoritesManager>(
    TYPES.IFavoritesManager
  );

  // Library service for "My Library" mode - lazily resolved
  let libraryService: ILibraryRepository | null = null;
  function getLibraryRepository(): ILibraryRepository | null {
    if (!libraryService) {
      libraryService = tryResolve<ILibraryRepository>(TYPES.ILibraryRepository);
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
      console.warn("[DiscoverState] Failed to load persisted controls:", error);
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
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("[DiscoverState] Failed to persist controls:", error);
    }
  }

  const persisted = loadPersistedControls();

  // State
  let isLoading = $state(false);
  let currentSource = $state<GallerySource>("community");
  let error = $state<string | null>(null);
  let displayedSequences = $state<SequenceData[]>([]);
  let allSequences = $state<SequenceData[]>([]);
  let selectedSequence = $state<SequenceData | null>(null);
  let navigationSections = $state<ExploreNavigationConfig[]>([]);
  let sequenceSections = $state<SequenceSection[]>([]);
  let currentSortMethod = $state<ExploreSortMethod>(
    persisted?.sortMethod || ExploreSortMethod.ALPHABETICAL
  );
  let sortDirection = $state<"asc" | "desc">(persisted?.sortDirection || "asc");
  const showSections = $state<boolean>(true);
  let currentFilter = $state<{ type: string; value: ExploreFilterValue }>(
    persisted?.filter || {
      type: "all",
      value: null,
    }
  );
  let filteredSequences = $state<SequenceData[]>([]);
  let isFilterModalOpen = $state<boolean>(false);

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
      // Calculate correct sequence length: beats.length - 2
      // Subtract 2 for metadata beat and start position beat
      const length = seq.beats.length - 2;
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

  // Load all sequences and generate navigation
  async function loadAllSequences(): Promise<void> {
    try {
      isLoading = true;
      error = null;
      const sequences = await loaderService.loadSequenceMetadata();
      allSequences = sequences;
      displayedSequences = sequences;
      const sections = Navigator.generateNavigationSections(sequences, []);
      navigationSections = sections;
      applyFilterAndSort();
      await generateSequenceSections();
    } catch (err) {
      console.error("Failed to load sequences:", err);
      error = err instanceof Error ? err.message : "Failed to load sequences";
    } finally {
      isLoading = false;
    }
  }

  // Load user's library sequences
  // When impersonating, Firestore rules allow admins to read any user's library
  async function loadLibrarySequences(): Promise<void> {
    const libService = getLibraryRepository();
    if (!libService) {
      error = "Please sign in to view your library";
      allSequences = [];
      displayedSequences = [];
      sequenceSections = [];
      return;
    }

    try {
      isLoading = true;
      error = null;
      const librarySequences = await libService.getSequences();
      // LibrarySequence extends SequenceData, so this is compatible
      allSequences = librarySequences;
      displayedSequences = librarySequences;
      const sections = Navigator.generateNavigationSections(
        librarySequences,
        []
      );
      navigationSections = sections;
      applyFilterAndSort();
      await generateSequenceSections();
    } catch (err) {
      console.error("Failed to load library sequences:", err);
      error = err instanceof Error ? err.message : "Failed to load library";
    } finally {
      isLoading = false;
    }
  }

  // Switch source and reload data
  async function setSource(source: GallerySource): Promise<void> {
    if (source === currentSource) {
      return;
    }

    currentSource = source;

    if (source === "my-library") {
      await loadLibrarySequences();
    } else {
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
      (i: ExploreNavigationItem) => i.id === itemId
    );
    if (!item) return;

    // Update active state
    navigationSections = navigationSections.map((s) => ({
      ...s,
      items: s.items.map((i: ExploreNavigationItem) => ({
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
        galleryPanelManager.updateActiveSequence(updatedSequence);
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
      // Apply filtering
      let filtered = allSequences;
      if (currentFilter.type !== "all") {
        filtered = filterService.applyFilter(
          allSequences,
          currentFilter.type as ExploreFilterType,
          currentFilter.value
        );
      }

      // Apply sorting
      const sorted = sortService.sortSequences(filtered, currentSortMethod);

      // TODO: Apply sort direction (galleryService.sortSequences doesn't handle direction yet)
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
        case ExploreSortMethod.ALPHABETICAL:
          groupBy = "letter";
          break;
        case ExploreSortMethod.DIFFICULTY_LEVEL:
          groupBy = "difficulty";
          break;
        case ExploreSortMethod.SEQUENCE_LENGTH:
          groupBy = "length";
          break;
        case ExploreSortMethod.DATE_ADDED:
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

  // Handle filter changes
  async function handleFilterChange(
    type: string,
    value?: ExploreFilterValue
  ): Promise<void> {
    currentFilter = { type, value: value || null };
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
  }

  // Handle sort changes
  async function handleSortChange(
    method: ExploreSortMethod,
    direction: "asc" | "desc"
  ): Promise<void> {
    currentSortMethod = method;
    sortDirection = direction;
    persistControls();
    await applyFilterAndSort();
    await generateSequenceSections();
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

    // Methods
    loadAllSequences,
    loadLibrarySequences,
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

    // Compatibility stubs
    backToFilters,
    toggleNavigationSection,
  };
}
