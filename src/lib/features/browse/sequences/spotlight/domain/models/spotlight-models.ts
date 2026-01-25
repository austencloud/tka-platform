/**
 * Spotlight Models
 *
 * Domain models for the spotlight module state and configuration.
 */

export interface SpotlightDisplayState {
  isVisible: boolean;
  isClosing: boolean;
  isContentVisible: boolean;
  currentVariationIndex: number;
}

export interface SpotlightImageState {
  isLoading: boolean;
  hasError: boolean;
  loadStartTime: number;
}

export interface SpotlightNavigationState {
  canGoPrev: boolean;
  canGoNext: boolean;
  hasMultipleVariations: boolean;
  totalVariations: number;
}

export interface SpotlightViewState {
  display: SpotlightDisplayState;
  image: SpotlightImageState;
  navigation: SpotlightNavigationState;
}

// Factory functions for default states
export function createDefaultSpotlightDisplayState(): SpotlightDisplayState {
  return {
    isVisible: false,
    isClosing: false,
    isContentVisible: false,
    currentVariationIndex: 0,
  };
}

export function createDefaultImageState(): SpotlightImageState {
  return {
    isLoading: true,
    hasError: false,
    loadStartTime: 0,
  };
}

export function createDefaultNavigationState(): SpotlightNavigationState {
  return {
    canGoPrev: false,
    canGoNext: false,
    hasMultipleVariations: false,
    totalVariations: 0,
  };
}
