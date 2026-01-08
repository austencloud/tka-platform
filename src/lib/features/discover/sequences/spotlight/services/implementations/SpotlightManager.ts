/**
 * Spotlight Service Implementation
 *
 * Handles spotlight business logic and state coordination.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { injectable } from "inversify";
import type {
  SpotlightDisplayState,
  SpotlightImageState,
  SpotlightNavigationState,
  SpotlightViewState,
} from "../../domain/models/spotlight-models";
import {
  createDefaultImageState,
  createDefaultNavigationState,
  createDefaultSpotlightDisplayState,
} from "../../domain/models/spotlight-models";
import type { ISpotlightManager } from "../contracts/ISpotlightManager";

@injectable()
export class SpotlightManager implements ISpotlightManager {
  private displayState: SpotlightDisplayState =
    createDefaultSpotlightDisplayState();
  private imageState: SpotlightImageState = createDefaultImageState();
  private navigationState: SpotlightNavigationState =
    createDefaultNavigationState();

  initializeSpotlight(sequence: SequenceData): void {
    // Reset to defaults
    this.displayState = createDefaultSpotlightDisplayState();
    this.imageState = createDefaultImageState();
    this.imageState.loadStartTime = performance.now();

    // Calculate navigation state
    this.calculateNavigationState(sequence, 0);
  }

  resetSpotlightState(): void {
    this.displayState = createDefaultSpotlightDisplayState();
    this.imageState = createDefaultImageState();
    this.navigationState = createDefaultNavigationState();
  }

  handleVariationChange(newIndex: number): void {
    this.displayState.currentVariationIndex = newIndex;
    this.displayState.isContentVisible = false;
    this.imageState.isLoading = true;
    this.imageState.hasError = false;
    this.imageState.loadStartTime = performance.now();
  }

  handleImageLoad(): void {
    this.imageState.isLoading = false;
    this.imageState.hasError = false;
    this.displayState.isContentVisible = true;
  }

  handleImageError(): void {
    this.imageState.isLoading = false;
    this.imageState.hasError = true;
  }

  handleShow(): void {
    this.displayState.isVisible = true;
    this.displayState.isClosing = false;
    this.displayState.isContentVisible = false;
  }

  handleClose(): void {
    this.displayState.isClosing = true;
  }

  getCurrentState(): SpotlightViewState {
    return {
      display: { ...this.displayState },
      image: { ...this.imageState },
      navigation: { ...this.navigationState },
    };
  }

  calculateNavigationState(sequence: SequenceData, currentIndex: number): void {
    const totalVariations = sequence.thumbnails.length || 0;

    this.navigationState = {
      hasMultipleVariations: totalVariations > 1,
      totalVariations,
      canGoPrev: currentIndex > 0,
      canGoNext: currentIndex < totalVariations - 1,
    };

    this.displayState.currentVariationIndex = currentIndex;
  }
}
