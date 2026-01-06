/**
 * Spotlight State Factory
 *
 * Reactive state management for spotlight module using Svelte 5 runes.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IDiscoverThumbnailProvider } from "../../display/services/contracts/IDiscoverThumbnailProvider";
import type {
  SpotlightDisplayState,
  SpotlightImageState,
  SpotlightNavigationState,
  SpotlightViewState,
} from "../domain/models/spotlight-models";
import {
  createDefaultImageState,
  createDefaultNavigationState,
  createDefaultSpotlightDisplayState,
} from "../domain/models/spotlight-models";

/**
 * Factory function to create spotlight state
 * Uses Svelte 5 runes for reactivity
 */
export function createSpotlightState() {
  // Private reactive state using Svelte 5 runes
  const displayState = $state<SpotlightDisplayState>(
    createDefaultSpotlightDisplayState()
  );
  const imageState = $state<SpotlightImageState>(createDefaultImageState());
  let navigationState = $state<SpotlightNavigationState>(
    createDefaultNavigationState()
  );
  let currentSequence = $state<SequenceData | null>(null);
  let thumbnailService = $state<IDiscoverThumbnailProvider | null>(null);

  // Helper functions
  function updateNavigationState(): void {
    const totalVariations = currentSequence?.thumbnails?.length ?? 0;
    const _currentIndex = displayState.currentVariationIndex;

    navigationState = {
      hasMultipleVariations: totalVariations > 1,
      totalVariations,
      canGoPrev: totalVariations > 1,
      canGoNext: totalVariations > 1,
    };
  }

  function getThumbnailUrl(thumbnailPath: string): string {
    if (!thumbnailService || !currentSequence) return "";

    try {
      if (
        thumbnailPath.startsWith("http://") ||
        thumbnailPath.startsWith("https://")
      ) {
        return thumbnailPath;
      }
      return thumbnailService.getThumbnailUrl(
        currentSequence.id,
        thumbnailPath
      );
    } catch (error) {
      console.error("Error getting thumbnail URL:", error);
      return "";
    }
  }

  function resetImageState(): void {
    displayState.isContentVisible = false;
    imageState.isLoading = true;
    imageState.hasError = false;
    imageState.loadStartTime = performance.now();
  }

  return {
    // Getters
    get isVisible() {
      return displayState.isVisible;
    },
    get isClosing() {
      return displayState.isClosing;
    },
    get isContentVisible() {
      return displayState.isContentVisible;
    },
    get currentVariationIndex() {
      return displayState.currentVariationIndex;
    },
    get isImageLoading() {
      return imageState.isLoading;
    },
    get imageError() {
      return imageState.hasError;
    },
    get hasMultipleVariations() {
      return navigationState.hasMultipleVariations;
    },
    get canGoPrev() {
      return navigationState.canGoPrev;
    },
    get canGoNext() {
      return navigationState.canGoNext;
    },
    get totalVariations() {
      return navigationState.totalVariations;
    },
    get currentSequence() {
      return currentSequence;
    },

    // Derived state
    get currentVariation() {
      if (
        !currentSequence?.thumbnails ||
        currentSequence.thumbnails.length === 0
      ) {
        return null;
      }
      return (
        currentSequence.thumbnails[displayState.currentVariationIndex] ||
        currentSequence.thumbnails[0]
      );
    },

    get currentImageUrl() {
      const variation =
        currentSequence?.thumbnails[displayState.currentVariationIndex];
      if (!variation || !thumbnailService || !currentSequence) {
        return "";
      }
      return getThumbnailUrl(variation);
    },

    get variationInfo() {
      if (!currentSequence) return null;
      return {
        current: displayState.currentVariationIndex + 1,
        total: navigationState.totalVariations,
        canGoPrev: navigationState.canGoPrev,
        canGoNext: navigationState.canGoNext,
      };
    },

    // Methods
    initializeSpotlight(
      sequence: SequenceData,
      service: IDiscoverThumbnailProvider,
      show: boolean
    ): void {
      currentSequence = sequence;
      thumbnailService = service;

      // Reset display state
      displayState.currentVariationIndex = 0;
      displayState.isContentVisible = false;

      // Reset image state
      imageState.isLoading = true;
      imageState.hasError = false;
      imageState.loadStartTime = performance.now();

      // Calculate navigation state
      updateNavigationState();

      if (show) {
        displayState.isVisible = true;
        displayState.isClosing = false;
        displayState.isContentVisible = false;
      }
    },

    show(): void {
      displayState.isVisible = true;
      displayState.isClosing = false;
      displayState.isContentVisible = false;
    },

    close(): void {
      displayState.isClosing = true;
    },

    hide(): void {
      displayState.isVisible = false;
      displayState.isClosing = false;
      currentSequence = null;
      thumbnailService = null;
    },

    goToPreviousVariation(): void {
      if (navigationState.canGoPrev) {
        const totalVariations = navigationState.totalVariations;
        // Circular navigation: wrap to last when on first
        displayState.currentVariationIndex =
          (displayState.currentVariationIndex - 1 + totalVariations) %
          totalVariations;
        resetImageState();
        updateNavigationState();
      }
    },

    goToNextVariation(): void {
      if (navigationState.canGoNext) {
        const totalVariations = navigationState.totalVariations;
        // Circular navigation: wrap to first when on last
        displayState.currentVariationIndex =
          (displayState.currentVariationIndex + 1) % totalVariations;
        resetImageState();
        updateNavigationState();
      }
    },

    goToVariation(index: number): void {
      if (index >= 0 && index < navigationState.totalVariations) {
        displayState.currentVariationIndex = index;
        resetImageState();
        updateNavigationState();
      }
    },

    onImageLoaded(): void {
      imageState.isLoading = false;
      imageState.hasError = false;
      displayState.isContentVisible = true;
    },

    onImageError(): void {
      imageState.isLoading = false;
      imageState.hasError = true;
    },

    getCurrentState(): SpotlightViewState {
      return {
        display: { ...displayState },
        image: { ...imageState },
        navigation: { ...navigationState },
      };
    },
  };
}

// For backward compatibility, export a class-like interface
export class SpotlightState {
  private state = createSpotlightState();

  get isVisible() {
    return this.state.isVisible;
  }
  get isClosing() {
    return this.state.isClosing;
  }
  get isContentVisible() {
    return this.state.isContentVisible;
  }
  get currentVariationIndex() {
    return this.state.currentVariationIndex;
  }
  get isImageLoading() {
    return this.state.isImageLoading;
  }
  get imageError() {
    return this.state.imageError;
  }
  get hasMultipleVariations() {
    return this.state.hasMultipleVariations;
  }
  get canGoPrev() {
    return this.state.canGoPrev;
  }
  get canGoNext() {
    return this.state.canGoNext;
  }
  get totalVariations() {
    return this.state.totalVariations;
  }
  get currentSequence() {
    return this.state.currentSequence;
  }
  get currentVariation() {
    return this.state.currentVariation;
  }
  get currentImageUrl() {
    return this.state.currentImageUrl;
  }
  get variationInfo() {
    return this.state.variationInfo;
  }

  initializeSpotlight(
    sequence: SequenceData,
    service: IDiscoverThumbnailProvider,
    show: boolean
  ): void {
    this.state.initializeSpotlight(sequence, service, show);
  }

  show(): void {
    this.state.show();
  }
  close(): void {
    this.state.close();
  }
  hide(): void {
    this.state.hide();
  }
  goToPreviousVariation(): void {
    this.state.goToPreviousVariation();
  }
  goToNextVariation(): void {
    this.state.goToNextVariation();
  }
  goToVariation(index: number): void {
    this.state.goToVariation(index);
  }
  onImageLoaded(): void {
    this.state.onImageLoaded();
  }
  onImageError(): void {
    this.state.onImageError();
  }
  getCurrentState(): SpotlightViewState {
    return this.state.getCurrentState();
  }
}
