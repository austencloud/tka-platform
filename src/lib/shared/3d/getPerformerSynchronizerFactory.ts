import { createPerformerSynchronizer } from './services/implementations/PerformerSynchronizer';

/**
 * Factory function - creates a new PerformerSynchronizer instance each call (not a singleton).
 */
export function getPerformerSynchronizerFactory(): typeof createPerformerSynchronizer {
  return createPerformerSynchronizer;
}
