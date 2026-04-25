import type { IPoseLabelRepository } from './services/contracts/IPoseLabelRepository';
import { LocalPoseLabelRepository } from './services/implementations/LocalPoseLabelRepository';

let instance: IPoseLabelRepository | null = null;
export function getCollisionLabPoseLabelRepository(): IPoseLabelRepository {
  return instance ??= new LocalPoseLabelRepository();
}
