import { DiamondPoseEnumerator } from './services/implementations/DiamondPoseEnumerator';

let instance: DiamondPoseEnumerator | null = null;
export function getDiamondPoseEnumerator(): DiamondPoseEnumerator {
  return instance ??= new DiamondPoseEnumerator();
}
