import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SpotlightViewState } from "../../domain/models/spotlight-models";

export interface ISpotlightManager {
  initializeSpotlight(sequence: SequenceData): void;

  resetSpotlightState(): void;

  handleVariationChange(newIndex: number): void;

  handleImageLoad(): void;

  handleImageError(): void;

  handleShow(): void;

  handleClose(): void;

  getCurrentState(): SpotlightViewState;

  calculateNavigationState(sequence: SequenceData, currentIndex: number): void;
}
