/**
 * LOOPLabelerServiceLocator
 *
 * Centralized service resolution with caching for LOOP Labeler.
 * Separates DI concerns from state management.
 */

import * as sequenceLoaderModule from "../services/sequence-loader";
import { getLOOPLabelsFirebaseRepository } from "$lib/features/loop-labeler/get-loop-labels-firebase-repository";
import * as navigatorModule from "../services/navigator";
import { loopDetector as loopDetectorInstance } from "../services/loop-detector";
import type { ILOOPDetector } from "../services/ILOOPDetector";
import type { LOOPLabelsFirebaseRepository } from "../services/loop-labels-firebase-repository";

export class LOOPLabelerServiceLocator {
  private cachedLabelsRepository: LOOPLabelsFirebaseRepository | null = null;
  private cachedDetector: ILOOPDetector | null = null;

  /** Sequence loader functions module — always available */
  readonly sequenceLoader = sequenceLoaderModule;

  /** Navigator functions module — always available */
  readonly navigator = navigatorModule;

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

  get detector(): ILOOPDetector | null {
    if (!this.cachedDetector) {
      this.cachedDetector = loopDetectorInstance;
    }
    return this.cachedDetector;
  }

  /** Pre-cache all services (call after DI module is loaded) */
  cacheAll(): void {
    void this.labelsRepository;
    void this.detector;
  }

  /** Clear all cached services */
  clear(): void {
    this.cachedLabelsRepository = null;
    this.cachedDetector = null;
  }
}
