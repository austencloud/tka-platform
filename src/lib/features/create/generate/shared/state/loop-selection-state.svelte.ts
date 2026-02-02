/**
 * LOOP Selection State
 *
 * Reactive state manager for the LOOP selection modal.
 * Handles tab switching, mode selection, component selection, and loading states.
 */

import { LOOPComponent } from "../domain/models/generate-models";
import type {
  LOOPSelectionMode,
  LOOPPresetTab,
  LOOPWizardStep,
  UserLOOPPreset,
  LOOPPopularityData,
  FollowingPreset,
} from "../domain/models/loop-selection-types";

/**
 * Creates a reactive state manager for LOOP selection
 */
export function createLOOPSelectionState(
  initialComponents: Set<LOOPComponent> = new Set()
) {
  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  // Tab and mode
  let activeTab = $state<LOOPPresetTab>("trending");
  let mode = $state<LOOPSelectionMode>("quick-apply");

  // Wizard step (for tiny mobile)
  let wizardStep = $state<LOOPWizardStep>("mode");

  // Component selection
  let selectedComponents = $state<Set<LOOPComponent>>(
    new Set(initialComponents)
  );

  // UI state
  let presetsExpanded = $state(false);
  let showPresets = $state(false);

  // Loading states
  let isLoadingMyPresets = $state(false);
  let isLoadingTrending = $state(false);
  let isLoadingFollowing = $state(false);

  // Data
  let myPresets = $state<UserLOOPPreset[]>([]);
  let trendingData = $state<LOOPPopularityData[]>([]);
  let followingPresets = $state<FollowingPreset[]>([]);

  // Favorites (from localStorage, migrated from LOOPFavoritesManager)
  let favorites = $state<string[]>([]);

  // Errors
  let error = $state<string | null>(null);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const selectionCount = $derived(selectedComponents.size);

  const hasSelection = $derived(selectionCount > 0);

  const isMultiSelectMode = $derived(mode === "build-combo");

  const isLoading = $derived(
    isLoadingMyPresets || isLoadingTrending || isLoadingFollowing
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Set the active tab in the preset browser
   */
  function setActiveTab(tab: LOOPPresetTab): void {
    activeTab = tab;
  }

  /**
   * Set the selection mode
   */
  function setMode(newMode: LOOPSelectionMode): void {
    mode = newMode;
  }

  /**
   * Set the wizard step
   */
  function setWizardStep(step: LOOPWizardStep): void {
    wizardStep = step;
  }

  /**
   * Go to next wizard step
   */
  function nextWizardStep(): void {
    if (wizardStep === "mode") {
      wizardStep = "components";
    } else if (wizardStep === "components") {
      wizardStep = "confirm";
    }
  }

  /**
   * Go to previous wizard step
   */
  function prevWizardStep(): void {
    if (wizardStep === "confirm") {
      wizardStep = "components";
    } else if (wizardStep === "components") {
      wizardStep = "mode";
    }
  }

  /**
   * Toggle a component in the selection
   */
  function toggleComponent(component: LOOPComponent): void {
    const newSet = new Set(selectedComponents);
    if (newSet.has(component)) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }
    selectedComponents = newSet;
  }

  /**
   * Set the selected components directly
   */
  function setSelectedComponents(components: Set<LOOPComponent>): void {
    selectedComponents = new Set(components);
  }

  /**
   * Clear all selected components
   */
  function clearSelection(): void {
    selectedComponents = new Set();
  }

  /**
   * Select components from a preset
   */
  function selectPresetComponents(components: LOOPComponent[]): void {
    selectedComponents = new Set(components);
  }

  /**
   * Toggle presets section visibility
   */
  function togglePresetsExpanded(): void {
    presetsExpanded = !presetsExpanded;
  }

  /**
   * Toggle presets visibility (for collapsible UI)
   */
  function toggleShowPresets(): void {
    showPresets = !showPresets;
  }

  /**
   * Set my presets data
   */
  function setMyPresets(presets: UserLOOPPreset[]): void {
    myPresets = presets;
  }

  /**
   * Set trending data
   */
  function setTrendingData(data: LOOPPopularityData[]): void {
    trendingData = data;
  }

  /**
   * Set following presets data
   */
  function setFollowingPresets(presets: FollowingPreset[]): void {
    followingPresets = presets;
  }

  /**
   * Set favorites
   */
  function setFavorites(newFavorites: string[]): void {
    favorites = newFavorites;
  }

  /**
   * Toggle a favorite
   */
  function toggleFavorite(presetId: string): void {
    if (favorites.includes(presetId)) {
      favorites = favorites.filter((id) => id !== presetId);
    } else {
      favorites = [...favorites, presetId];
    }
  }

  /**
   * Check if a preset is favorited
   */
  function isFavorite(presetId: string): boolean {
    return favorites.includes(presetId);
  }

  /**
   * Set loading state for my presets
   */
  function setLoadingMyPresets(loading: boolean): void {
    isLoadingMyPresets = loading;
  }

  /**
   * Set loading state for trending
   */
  function setLoadingTrending(loading: boolean): void {
    isLoadingTrending = loading;
  }

  /**
   * Set loading state for following
   */
  function setLoadingFollowing(loading: boolean): void {
    isLoadingFollowing = loading;
  }

  /**
   * Set error message
   */
  function setError(message: string | null): void {
    error = message;
  }

  /**
   * Reset all state to defaults
   */
  function reset(): void {
    activeTab = "trending";
    mode = "quick-apply";
    wizardStep = "mode";
    selectedComponents = new Set();
    presetsExpanded = false;
    showPresets = false;
    isLoadingMyPresets = false;
    isLoadingTrending = false;
    isLoadingFollowing = false;
    error = null;
  }

  // ============================================================================
  // RETURN STATE OBJECT
  // ============================================================================

  return {
    // Getters (reactive)
    get activeTab() {
      return activeTab;
    },
    get mode() {
      return mode;
    },
    get wizardStep() {
      return wizardStep;
    },
    get selectedComponents() {
      return selectedComponents;
    },
    get presetsExpanded() {
      return presetsExpanded;
    },
    get showPresets() {
      return showPresets;
    },
    get isLoadingMyPresets() {
      return isLoadingMyPresets;
    },
    get isLoadingTrending() {
      return isLoadingTrending;
    },
    get isLoadingFollowing() {
      return isLoadingFollowing;
    },
    get myPresets() {
      return myPresets;
    },
    get trendingData() {
      return trendingData;
    },
    get followingPresets() {
      return followingPresets;
    },
    get favorites() {
      return favorites;
    },
    get error() {
      return error;
    },

    // Derived
    get selectionCount() {
      return selectionCount;
    },
    get hasSelection() {
      return hasSelection;
    },
    get isMultiSelectMode() {
      return isMultiSelectMode;
    },
    get isLoading() {
      return isLoading;
    },

    // Actions
    setActiveTab,
    setMode,
    setWizardStep,
    nextWizardStep,
    prevWizardStep,
    toggleComponent,
    setSelectedComponents,
    clearSelection,
    selectPresetComponents,
    togglePresetsExpanded,
    toggleShowPresets,
    setMyPresets,
    setTrendingData,
    setFollowingPresets,
    setFavorites,
    toggleFavorite,
    isFavorite,
    setLoadingMyPresets,
    setLoadingTrending,
    setLoadingFollowing,
    setError,
    reset,
  };
}

/**
 * Type for the state manager
 */
export type LOOPSelectionStateManager = ReturnType<
  typeof createLOOPSelectionState
>;
