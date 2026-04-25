import type { ITrainingDataStore } from './services/contracts/ITrainingDataStore';
import { TrainingDataStore } from './services/implementations/TrainingDataStore';

let instance: ITrainingDataStore | null = null;
export function getTrainingDataStore(): ITrainingDataStore {
  return instance ??= new TrainingDataStore();
}
