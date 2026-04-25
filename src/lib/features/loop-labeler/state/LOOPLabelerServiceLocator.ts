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
import type { ISequenceLoader } from "../services/contracts/ISequenceLoader";
import type { ILOOPLabelsFirebaseRepository } from "../services/contracts/ILOOPLabelsFirebaseRepository";
import type { INavigator } from "../services/contracts/INavigator";
import type { ILOOPDetector } from "../services/contracts/ILOOPDetector";

export class LOOPLabelerServiceLocator {
  private cachedSequenceLoader: ISequenceLoader | null = null;
  private cachedLabelsRepository: ILOOPLabelsFirebaseRepository | null = null;
  private cachedNavigator: INavigator | null = null;
  private cachedDetector: ILOOPDetector | null = null;

  get sequenceLoader(): ISequenceLoader | null {
    if (!this.cachedSequenceLoader) {
      this.cachedSequenceLoader =
        getSequenceLoader() as ISequenceLoader | null;
    }
    return this.cachedSequenceLoader;
  }

  get labelsRepository(): ILOOPLabelsFirebaseRepository | null {
    if (!this.cachedLabelsRepository) {
      try {
        this.cachedLabelsRepository =
          getLOOPLabelsFirebaseRepository() as ILOOPLabelsFirebaseRepository | null;
      } catch {
        return null;
      }
    }
    return this.cachedLabelsRepository;
  }

  get navigator(): INavigator | null {
    if (!this.cachedNavigator) {
      this.cachedNavigator = getLoopLabelerNavigator() as INavigator | null;
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
