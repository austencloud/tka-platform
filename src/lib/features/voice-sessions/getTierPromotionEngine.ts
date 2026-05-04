import * as tierPromotionEngine from './services/tier-promotion-engine';

export function getTierPromotionEngine(): typeof tierPromotionEngine {
  return tierPromotionEngine;
}
