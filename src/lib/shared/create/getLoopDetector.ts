import type { ILOOPDetector } from "./services/ILOOPDetector";

let instance: ILOOPDetector | null = null;

/**
 * Register the LOOPDetector singleton.
 * Called once from bootstrap.ts to avoid a reverse import (shared/ -> features/).
 */
export function registerLoopDetector(detector: ILOOPDetector): void {
  instance = detector;
}

export function getLoopDetector(): ILOOPDetector {
  if (!instance) {
    throw new Error(
      "LOOPDetector not registered. Call registerLoopDetector() at app startup."
    );
  }
  return instance;
}
