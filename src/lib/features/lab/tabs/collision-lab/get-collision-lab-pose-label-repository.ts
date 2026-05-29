import { LocalPoseLabelRepository } from './services/local-pose-label-repository';

let instance: LocalPoseLabelRepository | null = null;
export function getCollisionLabPoseLabelRepository(): LocalPoseLabelRepository {
  return instance ??= new LocalPoseLabelRepository();
}
