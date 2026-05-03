/**
 * LOOPLabelerServiceLocator
 *
 * Centralized service resolution with caching for LOOP Labeler.
 * Separates DI concerns from state management.
 */

import { getSequenceLoader } from "$lib/features/loop-labeler/getSequenceLoader";
import { getLOOPLabelsFirebaseRepository } from "$lib/features/loop-labeler/getLOOPLabelsFirebaseRepository";
import { getLoopLabelerNavigator } from "$lib/features/loop-labeler/getNavigator";
import { loopDetector as loopDetectorInstance } from "../services/implementations/LOOPDetector";
import type { Navigator } from "../services/implementations/Navigator";
import type { ILOOPDetector } from "../services/contracts/ILOOPDetector";
import type { SequenceLoader } from "../services/implementations/SequenceLoader";
import type { LOOPLabelsFirebaseRepository } from "../services/implementations/LOOPLabelsFirebaseRepository";

export class LOOPLabelerServiceLocator {
  private cachedSequenceLoader: SequenceLoader | null = null;
  private cachedLabelsRepository: LOOPLabelsFirebaseRepository | null = null;
  private cachedNavigator: Navigator | null = null;
  private cachedDetector: ILOOPDetector | null = null;

  get sequenceLoader(): SequenceLoader | null {
    if (!this.cachedSequenceLoader) {
      this.cachedSequenceLoader =
        getSequenceLoader() as SequenceLoader | null;
    }
    return this.cachedSequenceLoader;
  }

  get labelsRepository(): LOOPLabelsFirebaseRepository | null {
    if (!this.cachedLabelsRepository) {
      try {
        this.cachedLabelsRepository =
          getLOOPLabelsFirebaseRepository() as LOOPLabelsFirebaseRepository | null;
      } catch {
        return null;
      }
    }
    return this.cachedLabelsRepository;
  }

  get navigator(): Navigator | null {
    if (!this.cachedNavigator) {
      this.cachedNavigator = getLoopLabelerNavigator() as Navigator | null;
    }
    return this.cachedNavigator;
  }

  get detector(): ILOOPDetector | null {
    if (!this.cachedDetector) {
      this.cachedDetector = loopDetectorInstance;
    }
    return this.cachedDetector;
  }

  /** Pre-cache all services (call after DI module is loaded) */
  cacheAll(): void {
    // Access each getter to trigger caching
    void this.sequenceLoader;
    void this.labelsRepository;
    void this.navigator;
    void this.detector;
  }

  /** Clear all cached services */
  clear(): void {
    this.cachedSequenceLoader = null;
    this.cachedLabelsRepository = null;
    this.cachedNavigator = null;
    this.cachedDetector = null;
  }
}
