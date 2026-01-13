/**
 * Browse State - State management for browsing saved animations
 *
 * Manages:
 * - Loading saved animations from storage
 * - Filtering by mode, favorites, creator
 * - Sorting by date, name, popularity
 * - Selected animation for detail view
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ComposeMode } from "../../../shared/state/compose-module-state.svelte";

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

      // TODO: Replace with actual service call when persistence is ready
      // For now, return mock data
      const mockAnimations: SavedAnimation[] = [
        {
          id: "anim-1",
          name: "Hello World",
          mode: "single",
          sequences: [],
          createdAt: new Date("2025-01-15"),
          updatedAt: new Date("2025-01-15"),
          creator: "You",
          isFavorite: true,
          viewCount: 45,
          shareCount: 3,
        },
        {
          id: "anim-2",
          name: "Mirror Dance",
          mode: "mirror",
          sequences: [],
          createdAt: new Date("2025-01-14"),
          updatedAt: new Date("2025-01-14"),
          creator: "You",
          isFavorite: false,
          viewCount: 23,
          shareCount: 1,
        },
        {
          id: "anim-3",
          name: "Tunnel Vision",
          mode: "tunnel",
          sequences: [],
          createdAt: new Date("2025-01-13"),
          updatedAt: new Date("2025-01-13"),
          creator: "You",
          isFavorite: true,
          viewCount: 67,
          shareCount: 5,
        },
        {
          id: "anim-4",
          name: "Grid Performance",
          mode: "grid",
          sequences: [],
          createdAt: new Date("2025-01-12"),
          updatedAt: new Date("2025-01-12"),
          creator: "You",
          isFavorite: false,
          viewCount: 12,
          shareCount: 0,
        },
      ];

      animations = mockAnimations;
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
    const animation = animations.find((a) => a.id === animationId);
    if (animation) {
      animation.isFavorite = !animation.isFavorite;
      // TODO: Persist to storage
    }
  }

  async function deleteAnimation(animationId: string): Promise<void> {
    try {
      // TODO: Call delete service
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
