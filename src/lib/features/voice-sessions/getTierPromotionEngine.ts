import type { ITierPromotionEngine } from './services/contracts/ITierPromotionEngine';
import { TierPromotionEngine } from './services/implementations/TierPromotionEngine';

let instance: ITierPromotionEngine | null = null;
export function getTierPromotionEngine(): ITierPromotionEngine {
  return instance ??= new TierPromotionEngine();
}
