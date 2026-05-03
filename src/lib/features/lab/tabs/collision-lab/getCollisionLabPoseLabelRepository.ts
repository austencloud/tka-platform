import { LocalPoseLabelRepository } from './services/implementations/LocalPoseLabelRepository';

let instance: LocalPoseLabelRepository | null = null;
export function getCollisionLabPoseLabelRepository(): LocalPoseLabelRepository {
  return instance ??= new LocalPoseLabelRepository();
}
