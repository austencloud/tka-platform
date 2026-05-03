import { TierPromotionEngine } from './services/implementations/TierPromotionEngine';

let instance: TierPromotionEngine | null = null;
export function getTierPromotionEngine(): TierPromotionEngine {
  return instance ??= new TierPromotionEngine();
}
