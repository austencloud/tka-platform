import { TrainingDataStore } from './services/implementations/TrainingDataStore';

let instance: TrainingDataStore | null = null;
export function getTrainingDataStore(): TrainingDataStore {
  return instance ??= new TrainingDataStore();
}
