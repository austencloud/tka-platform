import type { IPoseEnumerator } from './services/contracts/IPoseEnumerator';
import { DiamondPoseEnumerator } from './services/implementations/DiamondPoseEnumerator';

let instance: IPoseEnumerator | null = null;
export function getDiamondPoseEnumerator(): IPoseEnumerator {
  return instance ??= new DiamondPoseEnumerator();
}
