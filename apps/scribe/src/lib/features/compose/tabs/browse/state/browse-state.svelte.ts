/**
 * Browse State - State management for browsing saved animations
 *
 * Manages:
 * - Loading saved compositions from Dexie storage
 * - Filtering by mode, favorites, creator
 * - Sorting by date, name, popularity
 * - Selected animation for detail view
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ComposeMode } from "../../../shared/state/compose-module-state.svelte";
import type { Composition } from "../../../compose/domain/types";
import { dexieCompositionRepository } from "../../../services/implementations/DexieCompositionRepository";

export interface SavedAnimation {
  id: string;
  name: string;
  mode: ComposeMode;
  sequences: SequenceData[]; // Array of sequences (1 for single, 2 for tunnel/mirror, 4 for grid)
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  creator: string;
  isFavorite: boolean;
  viewCount?: number;
  shareCount?: number;
}

export interface AnimationFilter {
  mode?: ComposeMode;
  favorites?: boolean;
  creator?: string;
  searchQuery?: string;
}

export type SortMethod = "date" | "name" | "popularity";
export type SortDirection = "asc" | "desc";

/**
 * Infer ComposeMode from a Composition's layout
 * Maps grid dimensions to the corresponding compose mode
 */
function inferModeFromComposition(composition: Composition): ComposeMode {
  const { rows, cols } = composition.layout;
  const totalCells = rows * cols;

  // Check if it's a mirror (2x1 layout with mirrored cells)
  if (rows === 2 && cols === 1) {
    const hasMirror = composition.cells.some((c) => c.isMirrored);
    if (hasMirror) return "mirror";
  }

  // Single cell
  if (totalCells === 1) return "single";

  // Side by side (1x2)
  if (rows === 1 && cols === 2) return "side-by-side";

  // Tunnel (cells with type "tunnel")
  const hasTunnelCells = composition.cells.some((c) => c.type === "tunnel");
  if (hasTunnelCells) return "tunnel";

  // Default to grid for any multi-cell layout
  return "grid";
}

/**
 * Convert a Composition to SavedAnimation format for display
 */
function compositionToAnimation(composition: Composition): SavedAnimation {
  // Collect all sequences from all cells
  const allSequences: SequenceData[] = composition.cells.flatMap(
    (c) => c.sequences
  );

  return {
    id: composition.id,
    name: composition.name,
    mode: inferModeFromComposition(composition),
    sequences: allSequences,
    thumbnailUrl: composition.thumbnailUrl,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
    creator: composition.creator,
    isFavorite: composition.isFavorite,
    viewCount: 0, // Not stored in Composition yet
    shareCount: 0, // Not stored in Composition yet
  };
}

/**
 * Create browse state instance
 */
export function createBrowseState() {
  // State
  let animations = $state<SavedAnimation[]>([]);
  let selectedAnimation = $state<SavedAnimation | null>(null);
  let currentFilter = $state<AnimationFilter>({});
  let sortMethod = $state<SortMethod>("date");
  let sortDirection = $state<SortDirection>("desc");
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Derived - filtered and sorted animations
  const filteredAnimations = $derived.by(() => {
    let result = [...animations];

    // Apply search filter FIRST
    if (currentFilter.searchQuery && currentFilter.searchQuery.trim()) {
      const query = currentFilter.searchQuery.toLowerCase().trim();
      result = result.filter(
        (anim) =>
          anim.name.toLowerCase().includes(query) ||
          anim.creator.toLowerCase().includes(query)
      );
    }

    // Apply mode filter
    if (currentFilter.mode) {
      result = result.filter((anim) => anim.mode === currentFilter.mode);
    }

    if (currentFilter.favorites) {
      result = result.filter((anim) => anim.isFavorite);
    }

    if (currentFilter.creator) {
      result = result.filter((anim) => anim.creator === currentFilter.creator);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortMethod) {
        case "date":
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "popularity": {
          const aPopularity = (a.viewCount || 0) + (a.shareCount || 0) * 2;
          const bPopularity = (b.viewCount || 0) + (b.shareCount || 0) * 2;
          comparison = aPopularity - bPopularity;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  });

  // Derived - check if any filters are active
  const hasActiveFilters = $derived(
    !!currentFilter.mode ||
      !!currentFilter.favorites ||
      !!currentFilter.searchQuery?.trim()
  );

  // Methods
  async function loadAnimations(): Promise<void> {
    try {
      isLoading = true;
      error = null;

      // Load compositions from Dexie and convert to SavedAnimation format
      const compositions = await dexieCompositionRepository.getCompositions({
        sortBy: "updatedAt",
        sortDirection: "desc",
      });

      animations = compositions.map(compositionToAnimation);
    } catch (err) {
      console.error("Failed to load animations:", err);
      error = err instanceof Error ? err.message : "Failed to load animations";
    } finally {
      isLoading = false;
    }
  }

  function setFilter(filter: AnimationFilter): void {
    currentFilter = filter;
  }

  function clearFilters(): void {
    currentFilter = {};
  }

  function setSort(method: SortMethod, direction: SortDirection): void {
    sortMethod = method;
    sortDirection = direction;
  }

  function selectAnimation(animation: SavedAnimation | null): void {
    selectedAnimation = animation;
  }

  function clearSelection(): void {
    selectedAnimation = null;
  }

  async function toggleFavorite(animationId: string): Promise<void> {
    try {
      const newFavoriteStatus =
        await dexieCompositionRepository.toggleFavorite(animationId);

      // Update local state
      const animation = animations.find((a) => a.id === animationId);
      if (animation) {
        animation.isFavorite = newFavoriteStatus;
        // Force reactivity by reassigning
        animations = [...animations];
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      error = err instanceof Error ? err.message : "Failed to toggle favorite";
    }
  }

  async function deleteAnimation(animationId: string): Promise<void> {
    try {
      await dexieCompositionRepository.deleteComposition(animationId);

      // Update local state
      animations = animations.filter((a) => a.id !== animationId);
      if (selectedAnimation?.id === animationId) {
        selectedAnimation = null;
      }
    } catch (err) {
      console.error("Failed to delete animation:", err);
      error = err instanceof Error ? err.message : "Failed to delete animation";
    }
  }

  function clearError(): void {
    error = null;
  }

  return {
    // State
    get animations() {
      return animations;
    },
    get filteredAnimations() {
      return filteredAnimations;
    },
    get selectedAnimation() {
      return selectedAnimation;
    },
    get currentFilter() {
      return currentFilter;
    },
    get sortMethod() {
      return sortMethod;
    },
    get sortDirection() {
      return sortDirection;
    },
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get hasActiveFilters() {
      return hasActiveFilters;
    },

    // Methods
    loadAnimations,
    setFilter,
    clearFilters,
    setSort,
    selectAnimation,
    clearSelection,
    toggleFavorite,
    deleteAnimation,
    clearError,
  };
}

// Singleton instance
let browseStateInstance: ReturnType<typeof createBrowseState> | null = null;

export function getBrowseState() {
  if (!browseStateInstance) {
    browseStateInstance = createBrowseState();
  }
  return browseStateInstance;
}
